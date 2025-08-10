/**
 * Agent Usage Tracker
 * Comprehensive monitoring of agent interactions and performance
 */

export interface AgentUsageMetrics {
  agentId: string;
  timestamp: number;
  sessionId: string;
  
  // Usage metrics
  invocationCount: number;
  totalProcessingTime: number;
  averageResponseTime: number;
  errorCount: number;
  successRate: number;
  
  // Cognitive metrics
  semanticDrift: number;
  cognitiveLoad: number;
  contextWindowUsage: number;
  memoryPressure: number;
  
  // Quality metrics
  responseCoherence: number;
  taskCompletionRate: number;
  userSatisfactionScore?: number;
  
  // Pattern analysis
  dominantPatterns: string[];
  vocabularyDiversity: number;
  structuralConsistency: number;
}

export interface TrainingSession {
  id: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  trainingProtocol: string;
  
  // Pre-training metrics
  baselineMetrics: Partial<AgentUsageMetrics>;
  
  // Post-training metrics
  improvedMetrics?: Partial<AgentUsageMetrics>;
  
  // Effectiveness scores
  consistencyImprovement?: number;
  loadReduction?: number;
  errorReduction?: number;
  performanceGain?: number;
}

export class AgentUsageTracker {
  private usageHistory: Map<string, AgentUsageMetrics[]> = new Map();
  private trainingSessions: Map<string, TrainingSession[]> = new Map();
  private activeAgents: Set<string> = new Set();
  private sessionMetrics: Map<string, any> = new Map();
  
  recordUsage(agentId: string, metrics: Partial<AgentUsageMetrics>): void {
    const history = this.usageHistory.get(agentId) || [];
    
    const fullMetrics: AgentUsageMetrics = {
      agentId,
      timestamp: Date.now(),
      sessionId: this.getCurrentSessionId(),
      invocationCount: metrics.invocationCount || 1,
      totalProcessingTime: metrics.totalProcessingTime || 0,
      averageResponseTime: metrics.averageResponseTime || 0,
      errorCount: metrics.errorCount || 0,
      successRate: metrics.successRate || 1,
      semanticDrift: metrics.semanticDrift || 0,
      cognitiveLoad: metrics.cognitiveLoad || 0,
      contextWindowUsage: metrics.contextWindowUsage || 0,
      memoryPressure: metrics.memoryPressure || 0,
      responseCoherence: metrics.responseCoherence || 1,
      taskCompletionRate: metrics.taskCompletionRate || 1,
      userSatisfactionScore: metrics.userSatisfactionScore,
      dominantPatterns: metrics.dominantPatterns || [],
      vocabularyDiversity: metrics.vocabularyDiversity || 0,
      structuralConsistency: metrics.structuralConsistency || 1
    };
    
    history.push(fullMetrics);
    this.usageHistory.set(agentId, history);
    this.activeAgents.add(agentId);
    
    // Keep only last 10000 entries per agent
    if (history.length > 10000) {
      history.shift();
    }
  }
  
  getMostUsedAgents(limit: number = 10): Array<{
    agentId: string;
    usageCount: number;
    averageLoad: number;
    trend: 'improving' | 'degrading' | 'stable';
  }> {
    const agentStats = new Map<string, any>();
    
    for (const [agentId, history] of this.usageHistory) {
      const recentHistory = history.slice(-100);
      const totalUsage = history.reduce((sum, m) => sum + m.invocationCount, 0);
      const avgLoad = recentHistory.reduce((sum, m) => sum + m.cognitiveLoad, 0) / recentHistory.length;
      
      // Calculate trend
      let trend: 'improving' | 'degrading' | 'stable' = 'stable';
      if (recentHistory.length > 20) {
        const firstHalf = recentHistory.slice(0, recentHistory.length / 2);
        const secondHalf = recentHistory.slice(recentHistory.length / 2);
        
        const firstAvg = firstHalf.reduce((sum, m) => sum + m.cognitiveLoad, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, m) => sum + m.cognitiveLoad, 0) / secondHalf.length;
        
        if (secondAvg < firstAvg - 0.1) trend = 'improving';
        else if (secondAvg > firstAvg + 0.1) trend = 'degrading';
      }
      
      agentStats.set(agentId, {
        agentId,
        usageCount: totalUsage,
        averageLoad: avgLoad,
        trend
      });
    }
    
    return Array.from(agentStats.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }
  
  startTrainingSession(agentId: string, protocol: string): string {
    const sessionId = `training-${agentId}-${Date.now()}`;
    
    // Capture baseline metrics
    const history = this.usageHistory.get(agentId) || [];
    const recentMetrics = history.slice(-50);
    
    const baseline: Partial<AgentUsageMetrics> = {
      semanticDrift: this.average(recentMetrics, 'semanticDrift'),
      cognitiveLoad: this.average(recentMetrics, 'cognitiveLoad'),
      errorCount: this.average(recentMetrics, 'errorCount'),
      successRate: this.average(recentMetrics, 'successRate'),
      responseCoherence: this.average(recentMetrics, 'responseCoherence')
    };
    
    const session: TrainingSession = {
      id: sessionId,
      agentId,
      startTime: Date.now(),
      trainingProtocol: protocol,
      baselineMetrics: baseline
    };
    
    const sessions = this.trainingSessions.get(agentId) || [];
    sessions.push(session);
    this.trainingSessions.set(agentId, sessions);
    
    return sessionId;
  }
  
  endTrainingSession(sessionId: string): {
    effectiveness: number;
    improvements: string[];
    recommendations: string[];
  } {
    // Find the training session
    let session: TrainingSession | undefined;
    let agentId: string | undefined;
    
    for (const [id, sessions] of this.trainingSessions) {
      const found = sessions.find(s => s.id === sessionId);
      if (found) {
        session = found;
        agentId = id;
        break;
      }
    }
    
    if (!session || !agentId) {
      throw new Error('Training session not found');
    }
    
    session.endTime = Date.now();
    
    // Capture post-training metrics
    const history = this.usageHistory.get(agentId) || [];
    const postMetrics = history.slice(-50);
    
    session.improvedMetrics = {
      semanticDrift: this.average(postMetrics, 'semanticDrift'),
      cognitiveLoad: this.average(postMetrics, 'cognitiveLoad'),
      errorCount: this.average(postMetrics, 'errorCount'),
      successRate: this.average(postMetrics, 'successRate'),
      responseCoherence: this.average(postMetrics, 'responseCoherence')
    };
    
    // Calculate improvements
    const baseline = session.baselineMetrics;
    const improved = session.improvedMetrics;
    
    session.consistencyImprovement = baseline.semanticDrift && improved.semanticDrift
      ? (baseline.semanticDrift - improved.semanticDrift) / baseline.semanticDrift
      : 0;
    
    session.loadReduction = baseline.cognitiveLoad && improved.cognitiveLoad
      ? (baseline.cognitiveLoad - improved.cognitiveLoad) / baseline.cognitiveLoad
      : 0;
    
    session.errorReduction = baseline.errorCount && improved.errorCount
      ? (baseline.errorCount - improved.errorCount) / Math.max(baseline.errorCount, 1)
      : 0;
    
    session.performanceGain = (
      (session.consistencyImprovement || 0) * 0.4 +
      (session.loadReduction || 0) * 0.3 +
      (session.errorReduction || 0) * 0.3
    );
    
    // Generate analysis
    const improvements: string[] = [];
    const recommendations: string[] = [];
    
    if (session.consistencyImprovement > 0.1) {
      improvements.push(`Semantic consistency improved by ${(session.consistencyImprovement * 100).toFixed(1)}%`);
    }
    
    if (session.loadReduction > 0.1) {
      improvements.push(`Cognitive load reduced by ${(session.loadReduction * 100).toFixed(1)}%`);
    }
    
    if (session.errorReduction > 0.1) {
      improvements.push(`Error rate reduced by ${(session.errorReduction * 100).toFixed(1)}%`);
    }
    
    if (improved.cognitiveLoad > 0.7) {
      recommendations.push('Consider reducing context window size');
    }
    
    if (improved.semanticDrift > 0.3) {
      recommendations.push('Increase training frequency or intensity');
    }
    
    if (session.performanceGain < 0.05) {
      recommendations.push('Try alternative training protocols');
    }
    
    return {
      effectiveness: session.performanceGain,
      improvements,
      recommendations
    };
  }
  
  analyzeAgentPatterns(agentId: string): {
    peakUsageHours: number[];
    averageSessionDuration: number;
    commonFailurePatterns: string[];
    performanceTrend: number[];
    optimalConfiguration?: any;
  } {
    const history = this.usageHistory.get(agentId) || [];
    
    // Analyze usage patterns
    const hourlyUsage = new Array(24).fill(0);
    history.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      hourlyUsage[hour]++;
    });
    
    const peakUsageHours = hourlyUsage
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);
    
    // Calculate average session duration
    const sessionDurations: number[] = [];
    let sessionStart = history[0]?.timestamp;
    
    for (let i = 1; i < history.length; i++) {
      if (history[i].timestamp - history[i - 1].timestamp > 300000) { // 5 min gap
        sessionDurations.push(history[i - 1].timestamp - sessionStart);
        sessionStart = history[i].timestamp;
      }
    }
    
    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 0;
    
    // Identify failure patterns
    const failurePatterns = new Map<string, number>();
    history.filter(m => m.errorCount > 0).forEach(m => {
      m.dominantPatterns.forEach(pattern => {
        failurePatterns.set(pattern, (failurePatterns.get(pattern) || 0) + 1);
      });
    });
    
    const commonFailurePatterns = Array.from(failurePatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
    
    // Calculate performance trend
    const windowSize = Math.min(100, Math.floor(history.length / 10));
    const performanceTrend: number[] = [];
    
    for (let i = 0; i < history.length; i += windowSize) {
      const window = history.slice(i, i + windowSize);
      const avgPerformance = window.reduce((sum, m) => 
        sum + (1 - m.cognitiveLoad) * m.successRate, 0
      ) / window.length;
      performanceTrend.push(avgPerformance);
    }
    
    return {
      peakUsageHours,
      averageSessionDuration,
      commonFailurePatterns,
      performanceTrend,
      optimalConfiguration: this.findOptimalConfiguration(history)
    };
  }
  
  private average(metrics: AgentUsageMetrics[], field: keyof AgentUsageMetrics): number {
    if (metrics.length === 0) return 0;
    const values = metrics.map(m => m[field]).filter(v => typeof v === 'number') as number[];
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  private findOptimalConfiguration(history: AgentUsageMetrics[]): any {
    // Group metrics by context window usage ranges
    const configs = new Map<string, { metrics: AgentUsageMetrics[], performance: number }>();
    
    history.forEach(m => {
      const contextRange = Math.floor(m.contextWindowUsage * 10) / 10;
      const memoryRange = Math.floor(m.memoryPressure * 10) / 10;
      const key = `ctx:${contextRange}-mem:${memoryRange}`;
      
      if (!configs.has(key)) {
        configs.set(key, { metrics: [], performance: 0 });
      }
      
      const config = configs.get(key)!;
      config.metrics.push(m);
    });
    
    // Calculate performance for each configuration
    let bestConfig: any = null;
    let bestPerformance = -Infinity;
    
    for (const [key, config] of configs) {
      if (config.metrics.length < 5) continue;
      
      const performance = config.metrics.reduce((sum, m) => 
        sum + (1 - m.cognitiveLoad) * m.successRate * (1 - m.semanticDrift), 0
      ) / config.metrics.length;
      
      config.performance = performance;
      
      if (performance > bestPerformance) {
        bestPerformance = performance;
        const [ctx, mem] = key.split('-').map(s => parseFloat(s.split(':')[1]));
        bestConfig = {
          contextWindowUsage: ctx,
          memoryPressure: mem,
          performance: performance,
          sampleSize: config.metrics.length
        };
      }
    }
    
    return bestConfig;
  }
  
  private getCurrentSessionId(): string {
    return `session-${Date.now()}`;
  }
  
  exportMetrics(): string {
    const data = {
      agents: Array.from(this.usageHistory.entries()).map(([agentId, history]) => ({
        agentId,
        totalUsage: history.reduce((sum, m) => sum + m.invocationCount, 0),
        averageLoad: this.average(history, 'cognitiveLoad'),
        averageDrift: this.average(history, 'semanticDrift'),
        successRate: this.average(history, 'successRate')
      })),
      trainingSessions: Array.from(this.trainingSessions.entries()).map(([agentId, sessions]) => ({
        agentId,
        sessionsCount: sessions.length,
        averageEffectiveness: sessions.reduce((sum, s) => sum + (s.performanceGain || 0), 0) / sessions.length
      })),
      exportedAt: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }
}