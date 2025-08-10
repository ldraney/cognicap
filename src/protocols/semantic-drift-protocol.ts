export interface SemanticDriftProtocol {
  version: '1.0.0';
  
  measurements: {
    terminologyConsistency: {
      description: 'Tracks how consistently an agent uses technical terms';
      method: 'cosine_similarity';
      threshold: 0.85;
      metrics: {
        termFrequency: Map<string, number>;
        synonymUsage: Map<string, string[]>;
        contextualVariance: number;
      };
    };
    
    conceptualCoherence: {
      description: 'Measures how well agent maintains conceptual understanding';
      method: 'semantic_embedding_distance';
      threshold: 0.90;
      metrics: {
        conceptEmbeddings: Float32Array[];
        driftVelocity: number;
        coherenceScore: number;
      };
    };
    
    responsePatterns: {
      description: 'Analyzes structural consistency in responses';
      method: 'pattern_matching';
      metrics: {
        structuralConsistency: number;
        formatAdherence: number;
        protocolCompliance: number;
      };
    };
  };
  
  cognitiveLoad: {
    contextWindowUsage: {
      description: 'Percentage of context window utilized';
      warning: 0.75;
      critical: 0.90;
    };
    
    processingLatency: {
      description: 'Time to generate responses';
      baselineMs: number;
      deviationThreshold: 1.5;
    };
    
    errorRate: {
      description: 'Frequency of inconsistent or erroneous outputs';
      acceptable: 0.02;
      warning: 0.05;
      critical: 0.10;
    };
  };
  
  experiments: {
    configurations: {
      baseline: {
        database: false;
        specialization: 'none';
        contextWindow: 'standard';
      };
      
      variants: Array<{
        id: string;
        database: boolean;
        specialization: 'expert' | 'generalist' | 'hybrid';
        contextWindow: 'minimal' | 'standard' | 'extended';
        memoryStrategy: 'ephemeral' | 'persistent' | 'hybrid';
      }>;
    };
    
    metrics: {
      performanceGain: number;
      consistencyImprovement: number;
      cognitiveEfficiency: number;
    };
  };
}

export class SemanticDriftMeasurement {
  private baseline: Map<string, any> = new Map();
  private measurements: Array<any> = [];
  
  establishBaseline(agentId: string, samples: string[]): void {
    const terms = this.extractTerminology(samples);
    const patterns = this.analyzePatterns(samples);
    
    this.baseline.set(agentId, {
      terminology: terms,
      patterns: patterns,
      timestamp: Date.now(),
      sampleCount: samples.length
    });
  }
  
  measureDrift(agentId: string, newSample: string): number {
    const baseline = this.baseline.get(agentId);
    if (!baseline) return 0;
    
    const currentTerms = this.extractTerminology([newSample]);
    const drift = this.calculateDrift(baseline.terminology, currentTerms);
    
    this.measurements.push({
      agentId,
      drift,
      timestamp: Date.now()
    });
    
    return drift;
  }
  
  private extractTerminology(samples: string[]): Map<string, number> {
    const terms = new Map<string, number>();
    
    for (const sample of samples) {
      const words = sample.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (this.isTechnicalTerm(word)) {
          terms.set(word, (terms.get(word) || 0) + 1);
        }
      }
    }
    
    return terms;
  }
  
  private analyzePatterns(samples: string[]): any {
    return {
      avgLength: samples.reduce((sum, s) => sum + s.length, 0) / samples.length,
      structureTypes: this.identifyStructures(samples),
      commonPhrases: this.extractCommonPhrases(samples)
    };
  }
  
  private calculateDrift(baseline: Map<string, number>, current: Map<string, number>): number {
    const allTerms = new Set([...baseline.keys(), ...current.keys()]);
    let similarity = 0;
    let total = 0;
    
    for (const term of allTerms) {
      const baselineFreq = baseline.get(term) || 0;
      const currentFreq = current.get(term) || 0;
      
      if (baselineFreq > 0 || currentFreq > 0) {
        similarity += Math.min(baselineFreq, currentFreq);
        total += Math.max(baselineFreq, currentFreq);
      }
    }
    
    return total > 0 ? 1 - (similarity / total) : 0;
  }
  
  private isTechnicalTerm(word: string): boolean {
    const technicalPatterns = [
      /^(api|sdk|cli|gui|ui|ux)$/i,
      /^(async|sync|await|promise)$/i,
      /^(function|method|class|interface)$/i,
      /^(database|query|index|schema)$/i,
      /^(agent|protocol|orchestrat)$/i,
      /^(semantic|cognitive|drift|overload)$/i
    ];
    
    return technicalPatterns.some(pattern => pattern.test(word));
  }
  
  private identifyStructures(samples: string[]): string[] {
    const structures = [];
    for (const sample of samples) {
      if (sample.includes('```')) structures.push('code_block');
      if (sample.match(/^\d+\./m)) structures.push('numbered_list');
      if (sample.match(/^[-*]/m)) structures.push('bullet_list');
      if (sample.match(/^#{1,6}\s/m)) structures.push('headers');
    }
    return [...new Set(structures)];
  }
  
  private extractCommonPhrases(samples: string[]): string[] {
    const phrases = new Map<string, number>();
    
    for (const sample of samples) {
      const words = sample.split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
        phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
      }
    }
    
    return Array.from(phrases.entries())
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase]) => phrase);
  }
}