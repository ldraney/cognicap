export interface CognitiveMetrics {
  agentId: string;
  timestamp: number;
  contextWindowUsage: number;
  processingLatency: number;
  errorRate: number;
  semanticConsistency: number;
  cognitiveLoadIndex: number;
}

export interface OverloadThresholds {
  contextWindow: {
    safe: 0.60;
    warning: 0.75;
    critical: 0.90;
  };
  latency: {
    baselineMs: number;
    warningMultiplier: 1.5;
    criticalMultiplier: 2.0;
  };
  errorRate: {
    acceptable: 0.02;
    warning: 0.05;
    critical: 0.10;
  };
  semanticDrift: {
    acceptable: 0.15;
    warning: 0.25;
    critical: 0.40;
  };
}

export class CognitiveOverloadDetector {
  private metrics: Map<string, CognitiveMetrics[]> = new Map();
  private baselines: Map<string, any> = new Map();
  private thresholds: OverloadThresholds = {
    contextWindow: {
      safe: 0.60,
      warning: 0.75,
      critical: 0.90
    },
    latency: {
      baselineMs: 1000,
      warningMultiplier: 1.5,
      criticalMultiplier: 2.0
    },
    errorRate: {
      acceptable: 0.02,
      warning: 0.05,
      critical: 0.10
    },
    semanticDrift: {
      acceptable: 0.15,
      warning: 0.25,
      critical: 0.40
    }
  };
  
  recordMetric(metric: CognitiveMetrics): void {
    const agentMetrics = this.metrics.get(metric.agentId) || [];
    agentMetrics.push(metric);
    
    if (agentMetrics.length > 1000) {
      agentMetrics.shift();
    }
    
    this.metrics.set(metric.agentId, agentMetrics);
    this.updateBaseline(metric.agentId);
  }
  
  calculateCognitiveLoad(agentId: string): number {
    const recent = this.getRecentMetrics(agentId, 10);
    if (recent.length === 0) return 0;
    
    const baseline = this.baselines.get(agentId) || this.createDefaultBaseline();
    
    const contextLoad = this.normalizeMetric(
      recent.map(m => m.contextWindowUsage).reduce((a, b) => a + b, 0) / recent.length,
      0,
      1
    );
    
    const latencyLoad = this.normalizeMetric(
      recent.map(m => m.processingLatency).reduce((a, b) => a + b, 0) / recent.length,
      baseline.latency,
      baseline.latency * 3
    );
    
    const errorLoad = this.normalizeMetric(
      recent.map(m => m.errorRate).reduce((a, b) => a + b, 0) / recent.length,
      0,
      0.20
    );
    
    const driftLoad = this.normalizeMetric(
      1 - (recent.map(m => m.semanticConsistency).reduce((a, b) => a + b, 0) / recent.length),
      0,
      0.50
    );
    
    const weights = {
      context: 0.25,
      latency: 0.25,
      error: 0.30,
      drift: 0.20
    };
    
    return (
      contextLoad * weights.context +
      latencyLoad * weights.latency +
      errorLoad * weights.error +
      driftLoad * weights.drift
    );
  }
  
  detectOverload(agentId: string): {
    isOverloaded: boolean;
    severity: 'none' | 'warning' | 'critical';
    factors: string[];
    recommendations: string[];
  } {
    const recent = this.getRecentMetrics(agentId, 5);
    if (recent.length === 0) {
      return {
        isOverloaded: false,
        severity: 'none',
        factors: [],
        recommendations: []
      };
    }
    
    const avgMetrics = {
      contextWindow: recent.map(m => m.contextWindowUsage).reduce((a, b) => a + b, 0) / recent.length,
      latency: recent.map(m => m.processingLatency).reduce((a, b) => a + b, 0) / recent.length,
      errorRate: recent.map(m => m.errorRate).reduce((a, b) => a + b, 0) / recent.length,
      semanticDrift: 1 - (recent.map(m => m.semanticConsistency).reduce((a, b) => a + b, 0) / recent.length)
    };
    
    const factors: string[] = [];
    const recommendations: string[] = [];
    let severity: 'none' | 'warning' | 'critical' = 'none';
    
    if (avgMetrics.contextWindow >= this.thresholds.contextWindow.critical) {
      factors.push('Critical context window usage');
      recommendations.push('Reduce context size or implement chunking');
      severity = 'critical';
    } else if (avgMetrics.contextWindow >= this.thresholds.contextWindow.warning) {
      factors.push('High context window usage');
      recommendations.push('Consider context optimization');
      if (severity === 'none') severity = 'warning';
    }
    
    const baseline = this.baselines.get(agentId) || this.createDefaultBaseline();
    if (avgMetrics.latency >= baseline.latency * this.thresholds.latency.criticalMultiplier) {
      factors.push('Critical processing latency');
      recommendations.push('Investigate performance bottlenecks');
      severity = 'critical';
    } else if (avgMetrics.latency >= baseline.latency * this.thresholds.latency.warningMultiplier) {
      factors.push('Elevated processing latency');
      recommendations.push('Monitor system resources');
      if (severity === 'none') severity = 'warning';
    }
    
    if (avgMetrics.errorRate >= this.thresholds.errorRate.critical) {
      factors.push('Critical error rate');
      recommendations.push('Review agent training and protocols');
      severity = 'critical';
    } else if (avgMetrics.errorRate >= this.thresholds.errorRate.warning) {
      factors.push('Elevated error rate');
      recommendations.push('Check recent changes and inputs');
      if (severity === 'none') severity = 'warning';
    }
    
    if (avgMetrics.semanticDrift >= this.thresholds.semanticDrift.critical) {
      factors.push('Critical semantic drift');
      recommendations.push('Retrain agent or reset context');
      severity = 'critical';
    } else if (avgMetrics.semanticDrift >= this.thresholds.semanticDrift.warning) {
      factors.push('Significant semantic drift');
      recommendations.push('Reinforce training protocols');
      if (severity === 'none') severity = 'warning';
    }
    
    return {
      isOverloaded: severity !== 'none',
      severity,
      factors,
      recommendations
    };
  }
  
  private getRecentMetrics(agentId: string, count: number): CognitiveMetrics[] {
    const allMetrics = this.metrics.get(agentId) || [];
    return allMetrics.slice(-count);
  }
  
  private updateBaseline(agentId: string): void {
    const metrics = this.metrics.get(agentId) || [];
    if (metrics.length < 20) return;
    
    const healthyMetrics = metrics
      .filter(m => m.errorRate < 0.05 && m.semanticConsistency > 0.85)
      .slice(-50);
    
    if (healthyMetrics.length > 10) {
      this.baselines.set(agentId, {
        latency: healthyMetrics.map(m => m.processingLatency).reduce((a, b) => a + b, 0) / healthyMetrics.length,
        contextUsage: healthyMetrics.map(m => m.contextWindowUsage).reduce((a, b) => a + b, 0) / healthyMetrics.length,
        consistency: healthyMetrics.map(m => m.semanticConsistency).reduce((a, b) => a + b, 0) / healthyMetrics.length
      });
    }
  }
  
  private createDefaultBaseline(): any {
    return {
      latency: this.thresholds.latency.baselineMs,
      contextUsage: 0.40,
      consistency: 0.90
    };
  }
  
  private normalizeMetric(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  
  generateReport(agentId: string): string {
    const overload = this.detectOverload(agentId);
    const cognitiveLoad = this.calculateCognitiveLoad(agentId);
    const recent = this.getRecentMetrics(agentId, 10);
    
    if (recent.length === 0) {
      return `No metrics available for agent ${agentId}`;
    }
    
    const avgMetrics = {
      contextWindow: recent.map(m => m.contextWindowUsage).reduce((a, b) => a + b, 0) / recent.length,
      latency: recent.map(m => m.processingLatency).reduce((a, b) => a + b, 0) / recent.length,
      errorRate: recent.map(m => m.errorRate).reduce((a, b) => a + b, 0) / recent.length,
      consistency: recent.map(m => m.semanticConsistency).reduce((a, b) => a + b, 0) / recent.length
    };
    
    return `
Cognitive Load Report for ${agentId}
=====================================

Overall Cognitive Load Index: ${(cognitiveLoad * 100).toFixed(1)}%
Status: ${overload.severity.toUpperCase()}

Current Metrics (10-sample average):
- Context Window Usage: ${(avgMetrics.contextWindow * 100).toFixed(1)}%
- Processing Latency: ${avgMetrics.latency.toFixed(0)}ms
- Error Rate: ${(avgMetrics.errorRate * 100).toFixed(2)}%
- Semantic Consistency: ${(avgMetrics.consistency * 100).toFixed(1)}%

${overload.isOverloaded ? `
⚠️ OVERLOAD DETECTED
Factors:
${overload.factors.map(f => `  - ${f}`).join('\n')}

Recommendations:
${overload.recommendations.map(r => `  • ${r}`).join('\n')}
` : '✅ Operating within normal parameters'}
    `.trim();
  }
}