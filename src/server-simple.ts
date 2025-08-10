import express from 'express';
import cors from 'cors';
import { SemanticDriftMeasurement } from './protocols/semantic-drift-protocol.js';
import { CognitiveOverloadDetector, CognitiveMetrics } from './core/cognitive-overload.js';
import { ExperimentRunner, AgentConfiguration } from './experiments/experiment-runner.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3025;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

const driftMeasurement = new SemanticDriftMeasurement();
const overloadDetector = new CognitiveOverloadDetector();
const experimentRunner = new ExperimentRunner();

const measurements = new Map<string, any[]>();
const experiments = new Map<string, any>();
const alerts: any[] = [];

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
  
  const agentMeasurements = measurements.get(agentId) || [];
  agentMeasurements.push({
    ...metric,
    drift_velocity: drift
  });
  measurements.set(agentId, agentMeasurements);
  
  const overload = overloadDetector.detectOverload(agentId);
  
  if (overload.isOverloaded) {
    alerts.push({
      agent_id: agentId,
      severity: overload.severity,
      message: `Overload detected: ${overload.factors.join(', ')}`,
      timestamp: Date.now()
    });
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
  
  const agentMeasurements = measurements.get(agentId) || [];
  const limitedMeasurements = agentMeasurements.slice(-Number(limit));
  const report = overloadDetector.generateReport(agentId);
  
  res.json({
    agentId,
    measurements: limitedMeasurements,
    report,
    currentLoad: overloadDetector.calculateCognitiveLoad(agentId)
  });
});

app.get('/api/drift/:agentId', (req, res) => {
  const { agentId } = req.params;
  
  const agentMeasurements = measurements.get(agentId) || [];
  const recentMeasurements = agentMeasurements.slice(-500);
  
  const analysis = {
    current: recentMeasurements[recentMeasurements.length - 1]?.semanticConsistency || 0,
    average: recentMeasurements.reduce((sum, m) => sum + m.semanticConsistency, 0) / recentMeasurements.length || 0,
    trend: recentMeasurements.length > 1 ? 
      (recentMeasurements[recentMeasurements.length - 1].semanticConsistency - recentMeasurements[0].semanticConsistency) : 0,
    volatility: 0
  };
  
  if (recentMeasurements.length > 1) {
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentMeasurements.length; i++) {
      const diff = recentMeasurements[i].semanticConsistency - recentMeasurements[i - 1].semanticConsistency;
      sumSquaredDiff += diff * diff;
    }
    analysis.volatility = Math.sqrt(sumSquaredDiff / (recentMeasurements.length - 1));
  }
  
  res.json({
    agentId,
    measurements: recentMeasurements,
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
  
  experiments.set(config.id, {
    configuration: config,
    results: result,
    created_at: Date.now()
  });
  
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
  
  const experiment = experiments.get(id);
  
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }
  
  res.json({
    id,
    configuration: experiment.configuration,
    results: experiment.results,
    createdAt: experiment.created_at
  });
});

app.get('/api/alerts', (req, res) => {
  const { limit = 50 } = req.query;
  
  res.json(alerts.slice(-Number(limit)).reverse());
});

app.get('/api/dashboard', (req, res) => {
  const agents = Array.from(measurements.keys());
  
  const dashboard = {
    agents: agents.map(agentId => {
      const agentMeasurements = measurements.get(agentId) || [];
      const latest = agentMeasurements[agentMeasurements.length - 1];
      const overload = overloadDetector.detectOverload(agentId);
      
      return {
        agentId,
        semanticConsistency: latest?.semanticConsistency || 0,
        cognitiveLoad: latest?.cognitiveLoadIndex || 0,
        status: overload.severity,
        lastMeasurement: latest?.timestamp || 0
      };
    }),
    totalMeasurements: Array.from(measurements.values()).reduce((sum, m) => sum + m.length, 0),
    activeAlerts: alerts.filter(a => a.timestamp > Date.now() - 3600000).length,
    experiments: experiments.size
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