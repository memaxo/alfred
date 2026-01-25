/**
 * Telemetry Auto-Tuning
 *
 * Automatically optimizes system parameters based on metrics.
 * Adjusts timeouts, cache sizes, and resource allocations.
 */

interface TelemetryMetrics {
  queryHistogramValues: (
    metric: string,
    startTime: number,
    endTime: number
  ) => Promise<number[]>;
  tuningApplied: {
    record: (payload: {
      parameter: string;
      old_value: number;
      new_value: number;
      confidence: number;
    }) => void;
    inc: (labels: { parameter: string; success: boolean }) => void;
  };
  tuningCycle: {
    record: (payload: {
      total_recommendations: number;
      applied: number;
      skipped: number;
    }) => void;
  };
}

const metrics: TelemetryMetrics = {
  async queryHistogramValues() {
    return [];
  },
  tuningApplied: {
    record() {},
    inc() {},
  },
  tuningCycle: {
    record() {},
  },
};

export interface TelemetryConfig {
  timeoutMultipliers: Map<string, number>;
  cacheSizes: Map<string, number>;
  resourceAllocations: Map<string, number>;
}

export interface TuningRecommendation {
  parameter: string;
  currentValue: number;
  recommendedValue: number;
  reason: string;
  confidence: number;
}

export class TelemetryAutoTuner {
  private config: TelemetryConfig = {
    timeoutMultipliers: new Map([
      ["plan_generation", 1.5],
      ["pattern_match", 1.2],
      ["template_save", 1.3],
    ]),
    cacheSizes: new Map([
      ["plan_cache", 100],
      ["pattern_cache", 50],
      ["template_cache", 200],
    ]),
    resourceAllocations: new Map([
      ["max_concurrent_plans", 5],
      ["max_concurrent_agents", 10],
    ]),
  };

  async analyzeAndTune(
    timeWindowMs = 3_600_000
  ): Promise<TuningRecommendation[]> {
    const now = Date.now();
    const startTime = now - timeWindowMs;

    const recommendations: TuningRecommendation[] = [];

    for (const [
      parameter,
      multiplier,
    ] of this.config.timeoutMultipliers.entries()) {
      const p95 = await this.getP95(parameter, startTime, now);
      const current = multiplier;
      const recommended = p95 * 1.2;

      if (recommended > current) {
        recommendations.push({
          parameter: `${parameter}_timeout_ms`,
          currentValue: current,
          recommendedValue: recommended,
          reason: `P95 latency is ${p95}ms, current timeout is ${current}x, increasing buffer to 1.2x`,
          confidence: this.calculateConfidence(p95, current),
        });
      }
    }

    return recommendations;
  }

  async getP95(
    metric: string,
    startTime: number,
    endTime: number
  ): Promise<number> {
    const values = await metrics.queryHistogramValues(
      metric,
      startTime,
      endTime
    );
    if (values.length === 0) {
      return 0;
    }

    values.sort((a, b) => a - b);
    const index95 = Math.floor(values.length * 0.95);
    return values[index95] || 0;
  }

  async applyTuning(recommendations: TuningRecommendation[]): Promise<void> {
    for (const rec of recommendations) {
      if (rec.confidence > 0.8) {
        await this.applyRecommendation(rec);
        metrics.tuningApplied.record({
          parameter: rec.parameter,
          old_value: rec.currentValue,
          new_value: rec.recommendedValue,
          confidence: rec.confidence,
        });
      }
    }
  }

  private async applyRecommendation(rec: TuningRecommendation): Promise<void> {
    const parameter = rec.parameter.replace("_timeout_ms", "");

    if (this.config.timeoutMultipliers.has(parameter)) {
      const newMultiplier = rec.recommendedValue / 60_000; // Base 60s timeout
      this.config.timeoutMultipliers.set(parameter, newMultiplier);

      const baseTimeout = 60_000;
      const newTimeout = baseTimeout * newMultiplier;
      process.env[`${parameter.toUpperCase()}_TIMEOUT_MS`] = String(newTimeout);
    }

    metrics.tuningApplied.inc({
      parameter: rec.parameter,
      success: true,
    });
  }

  private calculateConfidence(p95: number, current: number): number {
    const ratio = p95 / current;
    if (ratio > 1.5) {
      return 0.9;
    }
    if (ratio > 1.2) {
      return 0.7;
    }
    if (ratio > 1) {
      return 0.5;
    }
    return 0.3;
  }

  getCurrentConfig(): TelemetryConfig {
    return {
      timeoutMultipliers: new Map(this.config.timeoutMultipliers),
      cacheSizes: new Map(this.config.cacheSizes),
      resourceAllocations: new Map(this.config.resourceAllocations),
    };
  }

  async runTuningCycle(): Promise<void> {
    const recommendations = await this.analyzeAndTune();
    await this.applyTuning(recommendations);

    metrics.tuningCycle.record({
      total_recommendations: recommendations.length,
      applied: recommendations.filter((r) => r.confidence > 0.8).length,
      skipped: recommendations.filter((r) => r.confidence <= 0.8).length,
    });
  }
}

export const autoTuner = new TelemetryAutoTuner();
