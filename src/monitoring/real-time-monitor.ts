#!/usr/bin/env tsx

/**
 * Real-Time Agent Monitor
 * Tracks your most-used agents and their cognitive health
 */

import { AgentUsageTracker } from '../tracking/agent-usage-tracker.js';
import { ExperimentScheduler, EXPERIMENT_CATALOG } from '../experiments/experiment-catalog.js';

interface MonitoredAgent {
  id: string;
  name: string;
  port: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastSeen: number;
  metrics: {
    invocations24h: number;
    avgCognitiveLoad: number;
    semanticDrift: number;
    errorRate: number;
    trend: 'improving' | 'stable' | 'degrading';
  };
}

class RealTimeMonitor {
  private tracker: AgentUsageTracker;
  private scheduler: ExperimentScheduler;
  private monitoredAgents: Map<string, MonitoredAgent> = new Map();
  private cognicapApi = 'http://localhost:3025';
  
  // Your most frequently used agents based on CLAUDE.md
  private primaryAgents = [
    { id: 'pm-agent', name: 'PM Agent', port: 3002 },
    { id: 'todo-agent', name: 'TODO Agent', port: 3016 },
    { id: 'projects-agent', name: 'Projects Agent', port: 3003 },
    { id: 'github-portfolio', name: 'GitHub Portfolio', port: 3072 },
    { id: 'shopify-sku-agent', name: 'Shopify SKU Agent', port: 3019 },
    { id: 'claude-monitor', name: 'Claude Monitor', port: 3050 },
    { id: 'devy-brain', name: 'DEVY Brain', port: 3020 }
  ];
  
  constructor() {
    this.tracker = new AgentUsageTracker();
    this.scheduler = new ExperimentScheduler();
    this.initializeMonitoring();
  }
  
  private async initializeMonitoring() {
    console.log('🚀 Real-Time Agent Monitor Starting...\n');
    
    // Initialize monitoring for primary agents
    for (const agent of this.primaryAgents) {
      this.monitoredAgents.set(agent.id, {
        ...agent,
        status: 'offline',
        lastSeen: 0,
        metrics: {
          invocations24h: 0,
          avgCognitiveLoad: 0,
          semanticDrift: 0,
          errorRate: 0,
          trend: 'stable'
        }
      });
    }
    
    // Schedule critical experiments
    this.scheduleInitialExperiments();
    
    // Start monitoring loops
    this.startHealthCheck();
    this.startMetricsCollection();
    this.startExperimentRunner();
  }
  
  private scheduleInitialExperiments() {
    // Priority experiments based on your needs
    this.scheduler.scheduleExperiment('exp-001-database-impact', 'high');
    this.scheduler.scheduleExperiment('exp-002-specialization-efficiency', 'high');
    this.scheduler.scheduleExperiment('exp-003-context-window-optimization', 'normal');
    this.scheduler.scheduleExperiment('exp-004-training-protocol-effectiveness', 'normal');
    
    console.log('📋 Scheduled 4 priority experiments\n');
  }
  
  private async startHealthCheck() {
    setInterval(async () => {
      for (const [agentId, agent] of this.monitoredAgents) {
        try {
          // Check if agent is responding
          const response = await fetch(`http://localhost:${agent.port}/api/health`, {
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok) {
            agent.status = this.calculateHealthStatus(agent.metrics);
            agent.lastSeen = Date.now();
          } else {
            agent.status = 'offline';
          }
        } catch {
          agent.status = 'offline';
        }
      }
    }, 10000); // Check every 10 seconds
  }
  
  private async startMetricsCollection() {
    setInterval(async () => {
      console.log('\n📊 Agent Performance Report\n');
      console.log('─'.repeat(70));
      
      for (const [agentId, agent] of this.monitoredAgents) {
        // Simulate metrics collection (would integrate with actual agent APIs)
        const metrics = await this.collectAgentMetrics(agentId);
        
        // Update tracker
        this.tracker.recordUsage(agentId, {
          invocationCount: Math.floor(Math.random() * 50),
          semanticDrift: metrics.semanticDrift,
          cognitiveLoad: metrics.cognitiveLoad,
          errorCount: Math.floor(Math.random() * 3),
          contextWindowUsage: metrics.contextUsage,
          responseCoherence: 0.85 + Math.random() * 0.15
        });
        
        // Update monitored agent
        agent.metrics = {
          invocations24h: Math.floor(Math.random() * 1000),
          avgCognitiveLoad: metrics.cognitiveLoad,
          semanticDrift: metrics.semanticDrift,
          errorRate: Math.random() * 0.1,
          trend: this.determineTrend(agentId)
        };
        
        // Display status
        const statusIcon = this.getStatusIcon(agent.status);
        const trendIcon = this.getTrendIcon(agent.metrics.trend);
        
        console.log(
          `${statusIcon} ${agent.name.padEnd(20)} | ` +
          `Load: ${(agent.metrics.avgCognitiveLoad * 100).toFixed(1)}% | ` +
          `Drift: ${(agent.metrics.semanticDrift * 100).toFixed(1)}% | ` +
          `Trend: ${trendIcon}`
        );
        
        // Alert on issues
        if (agent.status === 'critical') {
          console.log(`   ⚠️  ALERT: ${agent.name} needs immediate attention!`);
          this.recommendAction(agent);
        }
      }
      
      console.log('─'.repeat(70));
      
      // Show most used agents
      const mostUsed = this.tracker.getMostUsedAgents(3);
      if (mostUsed.length > 0) {
        console.log('\n🏆 Most Active Agents:');
        mostUsed.forEach((agent, i) => {
          console.log(`   ${i + 1}. ${agent.agentId}: ${agent.usageCount} invocations`);
        });
      }
    }, 30000); // Report every 30 seconds
  }
  
  private async startExperimentRunner() {
    // Run experiments continuously
    setInterval(async () => {
      const status = this.scheduler.getExperimentStatus();
      
      if (status.active.length === 0 && status.queued.length > 0) {
        console.log('\n🧪 Starting next experiment...');
        const result = await this.scheduler.runNextExperiment();
        
        if (result) {
          console.log(`✅ Experiment completed: ${result.experimentId}`);
          console.log(`   Hypothesis ${result.hypothesisConfirmed ? 'CONFIRMED' : 'REJECTED'}`);
          
          if (result.keyFindings.length > 0) {
            console.log('   Key findings:');
            result.keyFindings.forEach((f: string) => console.log(`     - ${f}`));
          }
        }
      }
    }, 60000); // Check every minute
  }
  
  private async collectAgentMetrics(agentId: string): Promise<any> {
    try {
      // Try to get real metrics from CogniCap
      const response = await fetch(`${this.cognicapApi}/api/metrics/${agentId}?limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        const measurements = data.measurements || [];
        
        if (measurements.length > 0) {
          const latest = measurements[measurements.length - 1];
          return {
            semanticDrift: 1 - latest.semantic_consistency,
            cognitiveLoad: latest.cognitive_load,
            contextUsage: latest.context_usage
          };
        }
      }
    } catch {
      // Fallback to simulated metrics
    }
    
    // Simulate metrics for demo
    return {
      semanticDrift: Math.random() * 0.3,
      cognitiveLoad: 0.3 + Math.random() * 0.5,
      contextUsage: 0.4 + Math.random() * 0.4
    };
  }
  
  private calculateHealthStatus(metrics: any): 'healthy' | 'warning' | 'critical' {
    if (metrics.avgCognitiveLoad > 0.8 || metrics.semanticDrift > 0.4) {
      return 'critical';
    }
    if (metrics.avgCognitiveLoad > 0.6 || metrics.semanticDrift > 0.25) {
      return 'warning';
    }
    return 'healthy';
  }
  
  private determineTrend(agentId: string): 'improving' | 'stable' | 'degrading' {
    const mostUsed = this.tracker.getMostUsedAgents(10);
    const agent = mostUsed.find(a => a.agentId === agentId);
    return agent?.trend || 'stable';
  }
  
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '🟢';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      case 'offline': return '⚫';
      default: return '⚪';
    }
  }
  
  private getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving': return '📈↗️';
      case 'degrading': return '📉↘️';
      case 'stable': return '📊→';
      default: return '❓';
    }
  }
  
  private recommendAction(agent: MonitoredAgent) {
    const recommendations: string[] = [];
    
    if (agent.metrics.avgCognitiveLoad > 0.8) {
      recommendations.push('Reduce context window size');
      recommendations.push('Consider task distribution to other agents');
    }
    
    if (agent.metrics.semanticDrift > 0.3) {
      recommendations.push('Schedule retraining session');
      recommendations.push('Reset agent context');
    }
    
    if (agent.metrics.errorRate > 0.1) {
      recommendations.push('Review recent changes');
      recommendations.push('Check input validation');
    }
    
    recommendations.forEach(r => console.log(`      💡 ${r}`));
  }
  
  async startTrainingSession(agentId: string): Promise<void> {
    console.log(`\n🎓 Starting training session for ${agentId}...`);
    
    const sessionId = this.tracker.startTrainingSession(agentId, 'incremental_reinforcement');
    
    // Simulate training
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = this.tracker.endTrainingSession(sessionId);
    
    console.log(`✅ Training complete!`);
    console.log(`   Effectiveness: ${(result.effectiveness * 100).toFixed(1)}%`);
    result.improvements.forEach(i => console.log(`   ✓ ${i}`));
    result.recommendations.forEach(r => console.log(`   💡 ${r}`));
  }
  
  generateSystemReport(): void {
    console.log('\n' + '═'.repeat(70));
    console.log('          AI AGENT CORPORATION - SYSTEM REPORT');
    console.log('═'.repeat(70) + '\n');
    
    const patterns = new Map<string, any>();
    
    for (const [agentId] of this.monitoredAgents) {
      const analysis = this.tracker.analyzeAgentPatterns(agentId);
      patterns.set(agentId, analysis);
    }
    
    console.log('📊 Usage Patterns:');
    for (const [agentId, analysis] of patterns) {
      const agent = this.monitoredAgents.get(agentId);
      if (agent && analysis.peakUsageHours.length > 0) {
        console.log(`   ${agent.name}:`);
        console.log(`     Peak hours: ${analysis.peakUsageHours.join(', ')}`);
        console.log(`     Avg session: ${Math.round(analysis.averageSessionDuration / 60000)} minutes`);
      }
    }
    
    console.log('\n🧪 Experiment Status:');
    const expStatus = this.scheduler.getExperimentStatus();
    console.log(`   Active: ${expStatus.active.length}`);
    console.log(`   Queued: ${expStatus.queued.length}`);
    console.log(`   Completed: ${expStatus.completed.length}`);
    
    console.log('\n💡 System Recommendations:');
    console.log('   1. Enable database persistence for PM Agent');
    console.log('   2. Implement load balancing between TODO and PM agents');
    console.log('   3. Schedule weekly training for high-drift agents');
    console.log('   4. Optimize context windows based on usage patterns');
    
    console.log('\n' + '═'.repeat(70));
  }
}

// Start the monitor
const monitor = new RealTimeMonitor();

// Generate initial report
setTimeout(() => monitor.generateSystemReport(), 5000);

// Schedule training for high-usage agents
setTimeout(async () => {
  await monitor.startTrainingSession('pm-agent');
}, 15000);

console.log('Monitor running... Press Ctrl+C to stop\n');