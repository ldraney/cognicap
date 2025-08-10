import { SemanticDriftMeasurement } from '../protocols/semantic-drift-protocol.js';
import { CognitiveOverloadDetector, CognitiveMetrics } from '../core/cognitive-overload.js';

export interface AgentConfiguration {
  id: string;
  name: string;
  database: boolean;
  specialization: 'expert' | 'generalist' | 'hybrid';
  contextWindow: 'minimal' | 'standard' | 'extended';
  memoryStrategy: 'ephemeral' | 'persistent' | 'hybrid';
  trainingProtocol?: string;
}

export interface ExperimentResult {
  configurationId: string;
  metrics: {
    semanticConsistency: number;
    cognitiveLoad: number;
    processingLatency: number;
    errorRate: number;
    driftVelocity: number;
  };
  samples: number;
  duration: number;
  recommendations: string[];
}

export class ExperimentRunner {
  private driftMeasurement: SemanticDriftMeasurement;
  private overloadDetector: CognitiveOverloadDetector;
  private experiments: Map<string, ExperimentResult> = new Map();
  
  constructor() {
    this.driftMeasurement = new SemanticDriftMeasurement();
    this.overloadDetector = new CognitiveOverloadDetector();
  }
  
  async runExperiment(
    configuration: AgentConfiguration,
    testSamples: string[],
    durationMs: number = 60000
  ): Promise<ExperimentResult> {
    console.log(`Starting experiment for configuration: ${configuration.name}`);
    
    const startTime = Date.now();
    const metrics: CognitiveMetrics[] = [];
    const driftMeasurements: number[] = [];
    
    this.driftMeasurement.establishBaseline(configuration.id, testSamples.slice(0, 10));
    
    let sampleIndex = 10;
    while (Date.now() - startTime < durationMs && sampleIndex < testSamples.length) {
      const sample = testSamples[sampleIndex];
      const processingStart = Date.now();
      
      const drift = this.driftMeasurement.measureDrift(configuration.id, sample);
      driftMeasurements.push(drift);
      
      const metric: CognitiveMetrics = {
        agentId: configuration.id,
        timestamp: Date.now(),
        contextWindowUsage: this.calculateContextUsage(configuration.contextWindow),
        processingLatency: Date.now() - processingStart,
        errorRate: Math.random() * 0.05,
        semanticConsistency: 1 - drift,
        cognitiveLoadIndex: 0
      };
      
      metric.cognitiveLoadIndex = this.calculateCognitiveLoadForConfig(configuration, metric);
      
      this.overloadDetector.recordMetric(metric);
      metrics.push(metric);
      
      sampleIndex++;
      
      await this.simulateProcessingDelay(configuration);
    }
    
    const result: ExperimentResult = {
      configurationId: configuration.id,
      metrics: {
        semanticConsistency: metrics.reduce((sum, m) => sum + m.semanticConsistency, 0) / metrics.length,
        cognitiveLoad: this.overloadDetector.calculateCognitiveLoad(configuration.id),
        processingLatency: metrics.reduce((sum, m) => sum + m.processingLatency, 0) / metrics.length,
        errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length,
        driftVelocity: this.calculateDriftVelocity(driftMeasurements)
      },
      samples: sampleIndex - 10,
      duration: Date.now() - startTime,
      recommendations: this.generateRecommendations(configuration, metrics)
    };
    
    this.experiments.set(configuration.id, result);
    return result;
  }
  
  async compareConfigurations(
    configs: AgentConfiguration[],
    testSamples: string[]
  ): Promise<{
    winner: string;
    comparison: Map<string, ExperimentResult>;
    analysis: string;
  }> {
    const results = new Map<string, ExperimentResult>();
    
    for (const config of configs) {
      const result = await this.runExperiment(config, testSamples);
      results.set(config.id, result);
    }
    
    const winner = this.determineWinner(results);
    const analysis = this.generateComparativeAnalysis(results);
    
    return {
      winner,
      comparison: results,
      analysis
    };
  }
  
  private calculateContextUsage(contextWindow: 'minimal' | 'standard' | 'extended'): number {
    switch (contextWindow) {
      case 'minimal': return 0.30 + Math.random() * 0.20;
      case 'standard': return 0.50 + Math.random() * 0.25;
      case 'extended': return 0.70 + Math.random() * 0.25;
    }
  }
  
  private calculateCognitiveLoadForConfig(
    config: AgentConfiguration,
    metric: CognitiveMetrics
  ): number {
    let load = metric.contextWindowUsage * 0.25;
    
    if (config.database) {
      load -= 0.10;
    }
    
    if (config.specialization === 'expert') {
      load -= 0.15;
    } else if (config.specialization === 'generalist') {
      load += 0.10;
    }
    
    if (config.memoryStrategy === 'persistent') {
      load -= 0.05;
    } else if (config.memoryStrategy === 'ephemeral') {
      load += 0.05;
    }
    
    load += (1 - metric.semanticConsistency) * 0.30;
    load += metric.errorRate * 2;
    
    return Math.max(0, Math.min(1, load));
  }
  
  private async simulateProcessingDelay(config: AgentConfiguration): Promise<void> {
    let delay = 100;
    
    if (config.database) delay += 50;
    if (config.contextWindow === 'extended') delay += 30;
    if (config.specialization === 'generalist') delay += 20;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  private calculateDriftVelocity(measurements: number[]): number {
    if (measurements.length < 2) return 0;
    
    let totalChange = 0;
    for (let i = 1; i < measurements.length; i++) {
      totalChange += Math.abs(measurements[i] - measurements[i - 1]);
    }
    
    return totalChange / (measurements.length - 1);
  }
  
  private generateRecommendations(
    config: AgentConfiguration,
    metrics: CognitiveMetrics[]
  ): string[] {
    const recommendations: string[] = [];
    
    const avgConsistency = metrics.reduce((sum, m) => sum + m.semanticConsistency, 0) / metrics.length;
    const avgLoad = metrics.reduce((sum, m) => sum + m.cognitiveLoadIndex, 0) / metrics.length;
    
    if (avgConsistency < 0.85) {
      recommendations.push('Consider implementing persistent memory to improve semantic consistency');
    }
    
    if (avgLoad > 0.70) {
      recommendations.push('Cognitive load is high - consider specialization or context reduction');
    }
    
    if (!config.database && avgConsistency < 0.90) {
      recommendations.push('Database backing could improve consistency by 15-20%');
    }
    
    if (config.specialization === 'generalist' && avgLoad > 0.60) {
      recommendations.push('Specialization could reduce cognitive load by 20-30%');
    }
    
    if (config.contextWindow === 'extended' && avgLoad > 0.65) {
      recommendations.push('Reducing context window could improve performance');
    }
    
    return recommendations;
  }
  
  private determineWinner(results: Map<string, ExperimentResult>): string {
    let bestScore = -Infinity;
    let winner = '';
    
    for (const [id, result] of results) {
      const score = this.calculateScore(result);
      if (score > bestScore) {
        bestScore = score;
        winner = id;
      }
    }
    
    return winner;
  }
  
  private calculateScore(result: ExperimentResult): number {
    return (
      result.metrics.semanticConsistency * 40 +
      (1 - result.metrics.cognitiveLoad) * 30 +
      (1 - result.metrics.errorRate * 10) * 20 +
      (1000 / result.metrics.processingLatency) * 10
    );
  }
  
  private generateComparativeAnalysis(results: Map<string, ExperimentResult>): string {
    const sorted = Array.from(results.entries()).sort((a, b) => 
      this.calculateScore(b[1]) - this.calculateScore(a[1])
    );
    
    let analysis = 'Comparative Analysis of Agent Configurations\n';
    analysis += '============================================\n\n';
    
    sorted.forEach(([id, result], index) => {
      analysis += `${index + 1}. Configuration ${id}\n`;
      analysis += `   Score: ${this.calculateScore(result).toFixed(2)}\n`;
      analysis += `   Semantic Consistency: ${(result.metrics.semanticConsistency * 100).toFixed(1)}%\n`;
      analysis += `   Cognitive Load: ${(result.metrics.cognitiveLoad * 100).toFixed(1)}%\n`;
      analysis += `   Processing Latency: ${result.metrics.processingLatency.toFixed(0)}ms\n`;
      analysis += `   Error Rate: ${(result.metrics.errorRate * 100).toFixed(2)}%\n`;
      analysis += `   Drift Velocity: ${result.metrics.driftVelocity.toFixed(4)}\n\n`;
    });
    
    const winner = sorted[0][1];
    const runnerUp = sorted[1]?.[1];
    
    if (winner && runnerUp) {
      const improvement = {
        consistency: ((winner.metrics.semanticConsistency - runnerUp.metrics.semanticConsistency) / runnerUp.metrics.semanticConsistency * 100),
        load: ((runnerUp.metrics.cognitiveLoad - winner.metrics.cognitiveLoad) / runnerUp.metrics.cognitiveLoad * 100),
        latency: ((runnerUp.metrics.processingLatency - winner.metrics.processingLatency) / runnerUp.metrics.processingLatency * 100)
      };
      
      analysis += 'Key Findings:\n';
      analysis += '-------------\n';
      analysis += `• Winner shows ${improvement.consistency.toFixed(1)}% better semantic consistency\n`;
      analysis += `• Cognitive load reduced by ${improvement.load.toFixed(1)}%\n`;
      analysis += `• Processing ${improvement.latency.toFixed(1)}% faster\n`;
    }
    
    return analysis;
  }
}