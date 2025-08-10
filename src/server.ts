import express from 'express';
import cors from 'cors';
import { SemanticDriftMeasurement } from './protocols/semantic-drift-protocol.js';
import { CognitiveOverloadDetector, CognitiveMetrics } from './core/cognitive-overload.js';
import { ExperimentRunner, AgentConfiguration } from './experiments/experiment-runner.js';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3025;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

const db = new Database(join(__dirname, '../data/cognicap.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    semantic_consistency REAL,
    cognitive_load REAL,
    context_usage REAL,
    processing_latency INTEGER,
    error_rate REAL,
    drift_velocity REAL
  );
  
  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    configuration TEXT NOT NULL,
    results TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
`);

const driftMeasurement = new SemanticDriftMeasurement();
const overloadDetector = new CognitiveOverloadDetector();
const experimentRunner = new ExperimentRunner();

const agentProfiles = new Map<string, any>();

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CogniCap',
    version: '1.0.0',
    port: PORT,
    timestamp: Date.now()
  });
});

app.post('/api/measure/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { sample, context } = req.body;
  
  if (!sample) {
    return res.status(400).json({ error: 'Sample text required' });
  }
  
  const drift = driftMeasurement.measureDrift(agentId, sample);
  
  const metric: CognitiveMetrics = {
    agentId,
    timestamp: Date.now(),
    contextWindowUsage: context?.usage || 0.5,
    processingLatency: context?.latency || 1000,
    errorRate: context?.errorRate || 0.01,
    semanticConsistency: 1 - drift,
    cognitiveLoadIndex: 0
  };
  
  overloadDetector.recordMetric(metric);
  metric.cognitiveLoadIndex = overloadDetector.calculateCognitiveLoad(agentId);
  
  const stmt = db.prepare(`
    INSERT INTO measurements (
      agent_id, timestamp, semantic_consistency, cognitive_load,
      context_usage, processing_latency, error_rate, drift_velocity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    agentId,
    metric.timestamp,
    metric.semanticConsistency,
    metric.cognitiveLoadIndex,
    metric.contextWindowUsage,
    metric.processingLatency,
    metric.errorRate,
    drift
  );
  
  const overload = overloadDetector.detectOverload(agentId);
  
  if (overload.isOverloaded) {
    const alertStmt = db.prepare(`
      INSERT INTO alerts (agent_id, severity, message, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    alertStmt.run(
      agentId,
      overload.severity,
      `Overload detected: ${overload.factors.join(', ')}`,
      Date.now()
    );
  }
  
  res.json({
    agentId,
    drift,
    semanticConsistency: metric.semanticConsistency,
    cognitiveLoad: metric.cognitiveLoadIndex,
    overload: overload.isOverloaded,
    severity: overload.severity,
    recommendations: overload.recommendations
  });
});

app.get('/api/metrics/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { limit = 100 } = req.query;
  
  const stmt = db.prepare(`
    SELECT * FROM measurements
    WHERE agent_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const measurements = stmt.all(agentId, Number(limit));
  const report = overloadDetector.generateReport(agentId);
  
  res.json({
    agentId,
    measurements: measurements.reverse(),
    report,
    currentLoad: overloadDetector.calculateCognitiveLoad(agentId)
  });
});

app.get('/api/drift/:agentId', (req, res) => {
  const { agentId } = req.params;
  
  const stmt = db.prepare(`
    SELECT 
      timestamp,
      semantic_consistency,
      drift_velocity
    FROM measurements
    WHERE agent_id = ?
    ORDER BY timestamp DESC
    LIMIT 500
  `);
  
  const measurements = stmt.all(agentId);
  
  const analysis = {
    current: measurements[0]?.semantic_consistency || 0,
    average: measurements.reduce((sum, m) => sum + m.semantic_consistency, 0) / measurements.length || 0,
    trend: measurements.length > 1 ? 
      (measurements[0].semantic_consistency - measurements[measurements.length - 1].semantic_consistency) : 0,
    volatility: 0
  };
  
  if (measurements.length > 1) {
    let sumSquaredDiff = 0;
    for (let i = 1; i < measurements.length; i++) {
      const diff = measurements[i].semantic_consistency - measurements[i - 1].semantic_consistency;
      sumSquaredDiff += diff * diff;
    }
    analysis.volatility = Math.sqrt(sumSquaredDiff / (measurements.length - 1));
  }
  
  res.json({
    agentId,
    measurements: measurements.reverse(),
    analysis
  });
});

app.post('/api/experiment/start', async (req, res) => {
  const { configuration, samples, duration } = req.body;
  
  if (!configuration || !samples) {
    return res.status(400).json({ error: 'Configuration and samples required' });
  }
  
  const config: AgentConfiguration = configuration;
  const result = await experimentRunner.runExperiment(config, samples, duration);
  
  const stmt = db.prepare(`
    INSERT INTO experiments (id, configuration, results, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(
    config.id,
    JSON.stringify(config),
    JSON.stringify(result),
    Date.now()
  );
  
  res.json(result);
});

app.post('/api/experiment/compare', async (req, res) => {
  const { configurations, samples } = req.body;
  
  if (!configurations || !samples) {
    return res.status(400).json({ error: 'Configurations and samples required' });
  }
  
  const comparison = await experimentRunner.compareConfigurations(configurations, samples);
  
  res.json(comparison);
});

app.get('/api/experiment/:id/results', (req, res) => {
  const { id } = req.params;
  
  const stmt = db.prepare(`
    SELECT * FROM experiments WHERE id = ?
  `);
  
  const experiment = stmt.get(id);
  
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }
  
  res.json({
    id,
    configuration: JSON.parse(experiment.configuration),
    results: JSON.parse(experiment.results),
    createdAt: experiment.created_at
  });
});

app.get('/api/alerts', (req, res) => {
  const { limit = 50 } = req.query;
  
  const stmt = db.prepare(`
    SELECT * FROM alerts
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const alerts = stmt.all(Number(limit));
  
  res.json(alerts);
});

app.get('/api/dashboard', (req, res) => {
  const agentStmt = db.prepare(`
    SELECT DISTINCT agent_id FROM measurements
  `);
  
  const agents = agentStmt.all().map(row => row.agent_id);
  
  const dashboard = {
    agents: agents.map(agentId => {
      const latestStmt = db.prepare(`
        SELECT * FROM measurements
        WHERE agent_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      
      const latest = latestStmt.get(agentId);
      const overload = overloadDetector.detectOverload(agentId);
      
      return {
        agentId,
        semanticConsistency: latest?.semantic_consistency || 0,
        cognitiveLoad: latest?.cognitive_load || 0,
        status: overload.severity,
        lastMeasurement: latest?.timestamp || 0
      };
    }),
    totalMeasurements: db.prepare('SELECT COUNT(*) as count FROM measurements').get().count,
    activeAlerts: db.prepare('SELECT COUNT(*) as count FROM alerts WHERE timestamp > ?').get(Date.now() - 3600000).count,
    experiments: db.prepare('SELECT COUNT(*) as count FROM experiments').get().count
  };
  
  res.json(dashboard);
});

app.post('/api/baseline/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { samples } = req.body;
  
  if (!samples || !Array.isArray(samples)) {
    return res.status(400).json({ error: 'Samples array required' });
  }
  
  driftMeasurement.establishBaseline(agentId, samples);
  
  agentProfiles.set(agentId, {
    baseline: {
      established: Date.now(),
      sampleCount: samples.length
    }
  });
  
  res.json({
    agentId,
    message: 'Baseline established',
    sampleCount: samples.length
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║             CogniCap Server Started                     ║
║                                                        ║
║  Cognitive Capacity Measurement System                 ║
║  Tracking Semantic Drift & Cognitive Overload         ║
║                                                        ║
║  Dashboard:    http://localhost:${PORT}                  ║
║  API Health:   http://localhost:${PORT}/api/health       ║
║  Metrics API:  http://localhost:${PORT}/api/metrics      ║
║                                                        ║
║  Ready to measure agent cognitive capacity!           ║
╚════════════════════════════════════════════════════════╝
  `);
});