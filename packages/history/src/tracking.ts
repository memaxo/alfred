/**
 * Token Usage and Cost Tracking Service
 *
 * Microservice-style tracking for token usage, costs, and budget enforcement.
 * Integrates with Prometheus metrics for observability.
 *
 * @module @alfred/history/tracking
 */

import type { ModelProvider } from "@alfred/type/model";

import { Counter, Gauge, Histogram, Registry } from "prom-client";

import { calculateBudget, type CalculatedBudget } from "./calculator";
import { getModelSpec } from "./registry";

// ============================================================================
// Types
// ============================================================================

export interface UsageRecord {
  id: string;
  timestamp: Date;
  modelId: string;
  provider: ModelProvider;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  costUsd: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalCostUsd: number;
  turnCount: number;
  avgLatencyMs: number;
  modelBreakdown: Map<string, ModelUsage>;
  budgetStatus: BudgetStatus;
}

export interface ModelUsage {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  turnCount: number;
}

export interface BudgetStatus {
  budgetUsd: number;
  usedUsd: number;
  remainingUsd: number;
  percentUsed: number;
  status: "healthy" | "warning" | "critical" | "exceeded";
  projectedTurnsRemaining: number;
}

export interface TrackingConfig {
  /** Session identifier */
  sessionId: string;
  /** USD budget limit */
  budgetUsd?: number;
  /** Model for budget calculation */
  modelId?: string;
  /** Enable detailed logging */
  verbose?: boolean;
  /** Custom Prometheus registry */
  registry?: Registry;
}

// ============================================================================
// Prometheus Metrics
// ============================================================================

const defaultRegistry = new Registry();

export const trackingMetrics = {
  // Token counters
  inputTokens: new Counter({
    help: "Total input tokens processed",
    labelNames: ["provider", "model", "session"],
    name: "alfred_tokens_input_total",
    registers: [defaultRegistry],
  }),

  outputTokens: new Counter({
    help: "Total output tokens generated",
    labelNames: ["provider", "model", "session"],
    name: "alfred_tokens_output_total",
    registers: [defaultRegistry],
  }),

  cachedTokens: new Counter({
    help: "Total cached input tokens (prompt cache hits)",
    labelNames: ["provider", "model", "session"],
    name: "alfred_tokens_cached_total",
    registers: [defaultRegistry],
  }),

  reasoningTokens: new Counter({
    help: "Total reasoning tokens (o1/R1 models)",
    labelNames: ["provider", "model", "session"],
    name: "alfred_tokens_reasoning_total",
    registers: [defaultRegistry],
  }),

  // Cost tracking
  costUsd: new Counter({
    help: "Total cost in USD",
    labelNames: ["provider", "model", "session"],
    name: "alfred_cost_usd_total",
    registers: [defaultRegistry],
  }),

  budgetRemaining: new Gauge({
    help: "Remaining budget in USD",
    labelNames: ["session"],
    name: "alfred_budget_remaining_usd",
    registers: [defaultRegistry],
  }),

  budgetUtilization: new Gauge({
    help: "Budget utilization percentage",
    labelNames: ["session"],
    name: "alfred_budget_utilization_percent",
    registers: [defaultRegistry],
  }),

  // Latency
  requestLatency: new Histogram({
    buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10_000, 30_000],
    help: "Request latency in milliseconds",
    labelNames: ["provider", "model"],
    name: "alfred_request_latency_ms",
    registers: [defaultRegistry],
  }),

  // Context utilization
  contextUtilization: new Histogram({
    buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    help: "Context window utilization percentage",
    labelNames: ["model"],
    name: "alfred_context_utilization_percent",
    registers: [defaultRegistry],
  }),

  // Budget alerts
  budgetAlerts: new Counter({
    help: "Budget alert events",
    labelNames: ["session", "alert_type"],
    name: "alfred_budget_alerts_total",
    registers: [defaultRegistry],
  }),

  // Turn counter
  turns: new Counter({
    help: "Total conversation turns",
    labelNames: ["provider", "model", "session"],
    name: "alfred_turns_total",
    registers: [defaultRegistry],
  }),
};

export function getTrackingRegistry(): Registry {
  return defaultRegistry;
}

// ============================================================================
// Usage Tracker Class
// ============================================================================

export class UsageTracker {
  readonly sessionId: string;
  readonly budgetUsd: number;
  readonly budget: CalculatedBudget;

  private records: UsageRecord[] = [];
  private startTime: Date;
  private modelUsage: Map<string, ModelUsage> = new Map();
  private totalCostUsd = 0;
  private verbose: boolean;

  constructor(config: TrackingConfig) {
    this.sessionId = config.sessionId;
    this.budgetUsd = config.budgetUsd ?? Infinity;
    this.startTime = new Date();
    this.verbose = config.verbose ?? false;

    // Calculate budget for primary model
    this.budget = calculateBudget({
      budgetUsd: this.budgetUsd,
      modelId: config.modelId ?? "openai/gpt-4o",
    });

    // Initialize budget gauge
    if (Number.isFinite(this.budgetUsd)) {
      trackingMetrics.budgetRemaining.set(
        { session: this.sessionId },
        this.budgetUsd
      );
      trackingMetrics.budgetUtilization.set({ session: this.sessionId }, 0);
    }
  }

  /**
   * Record a model usage event.
   */
  record(params: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    latencyMs: number;
    metadata?: Record<string, unknown>;
  }): UsageRecord {
    const spec = getModelSpec(params.modelId);
    const provider = spec?.provider ?? "openai";

    // Calculate cost
    const costUsd = this.calculateCost(
      params.modelId,
      params.inputTokens,
      params.outputTokens,
      params.cachedTokens ?? 0,
      params.reasoningTokens ?? 0
    );

    const record: UsageRecord = {
      cachedTokens: params.cachedTokens ?? 0,
      costUsd,
      id: `${this.sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      inputTokens: params.inputTokens,
      latencyMs: params.latencyMs,
      metadata: params.metadata,
      modelId: params.modelId,
      outputTokens: params.outputTokens,
      provider,
      reasoningTokens: params.reasoningTokens ?? 0,
      timestamp: new Date(),
    };

    this.records.push(record);
    this.totalCostUsd += costUsd;

    // Update model breakdown
    this.updateModelUsage(record);

    // Update Prometheus metrics
    this.updateMetrics(record);

    // Check budget status
    this.checkBudgetAlerts();

    if (this.verbose) {
      console.log(
        `[UsageTracker] ${params.modelId}: ${params.inputTokens} in, ${params.outputTokens} out, $${costUsd.toFixed(4)}`
      );
    }

    return record;
  }

  /**
   * Calculate cost for a usage event.
   */
  private calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number,
    reasoningTokens: number
  ): number {
    const spec = getModelSpec(modelId);
    if (!spec) {
      // Fallback pricing
      return (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 3;
    }

    const { pricing } = spec;

    // Non-cached input cost
    const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
    const inputCost = (nonCachedInput / 1_000_000) * pricing.inputPer1M;

    // Cached input cost
    const cachedCost = pricing.cachedInputPer1M
      ? (cachedTokens / 1_000_000) * pricing.cachedInputPer1M
      : 0;

    // Output cost
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

    // Reasoning cost (separate for o1/R1 models)
    const reasoningCost = pricing.reasoningPer1M
      ? (reasoningTokens / 1_000_000) * pricing.reasoningPer1M
      : 0;

    return inputCost + cachedCost + outputCost + reasoningCost;
  }

  /**
   * Update model usage breakdown.
   */
  private updateModelUsage(record: UsageRecord): void {
    const existing = this.modelUsage.get(record.modelId);

    if (existing) {
      existing.inputTokens += record.inputTokens;
      existing.outputTokens += record.outputTokens;
      existing.costUsd += record.costUsd;
      existing.turnCount += 1;
    } else {
      this.modelUsage.set(record.modelId, {
        costUsd: record.costUsd,
        inputTokens: record.inputTokens,
        modelId: record.modelId,
        outputTokens: record.outputTokens,
        turnCount: 1,
      });
    }
  }

  /**
   * Update Prometheus metrics.
   */
  private updateMetrics(record: UsageRecord): void {
    const labels = {
      model: record.modelId,
      provider: record.provider,
      session: this.sessionId,
    };

    trackingMetrics.inputTokens.inc(labels, record.inputTokens);
    trackingMetrics.outputTokens.inc(labels, record.outputTokens);
    trackingMetrics.costUsd.inc(labels, record.costUsd);
    trackingMetrics.turns.inc(labels);

    if (record.cachedTokens > 0) {
      trackingMetrics.cachedTokens.inc(labels, record.cachedTokens);
    }

    if (record.reasoningTokens > 0) {
      trackingMetrics.reasoningTokens.inc(labels, record.reasoningTokens);
    }

    trackingMetrics.requestLatency.observe(
      { model: record.modelId, provider: record.provider },
      record.latencyMs
    );

    // Update budget metrics
    if (Number.isFinite(this.budgetUsd)) {
      const remaining = Math.max(0, this.budgetUsd - this.totalCostUsd);
      const utilization = (this.totalCostUsd / this.budgetUsd) * 100;

      trackingMetrics.budgetRemaining.set(
        { session: this.sessionId },
        remaining
      );
      trackingMetrics.budgetUtilization.set(
        { session: this.sessionId },
        utilization
      );
    }
  }

  /**
   * Check and emit budget alerts.
   */
  private checkBudgetAlerts(): void {
    if (!Number.isFinite(this.budgetUsd)) {
      return;
    }

    const percentUsed = (this.totalCostUsd / this.budgetUsd) * 100;

    if (percentUsed >= 100) {
      trackingMetrics.budgetAlerts.inc({
        alert_type: "exceeded",
        session: this.sessionId,
      });
    } else if (percentUsed >= 90) {
      trackingMetrics.budgetAlerts.inc({
        alert_type: "critical",
        session: this.sessionId,
      });
    } else if (percentUsed >= 75) {
      trackingMetrics.budgetAlerts.inc({
        alert_type: "warning",
        session: this.sessionId,
      });
    }
  }

  /**
   * Get current budget status.
   */
  getBudgetStatus(): BudgetStatus {
    const usedUsd = this.totalCostUsd;
    const remainingUsd = Math.max(0, this.budgetUsd - usedUsd);
    const percentUsed = Number.isFinite(this.budgetUsd)
      ? (usedUsd / this.budgetUsd) * 100
      : 0;

    let status: BudgetStatus["status"] = "healthy";
    if (percentUsed >= 100) {
      status = "exceeded";
    } else if (percentUsed >= 90) {
      status = "critical";
    } else if (percentUsed >= 75) {
      status = "warning";
    }

    // Estimate turns remaining based on average cost
    const avgCostPerTurn =
      this.records.length > 0
        ? this.totalCostUsd / this.records.length
        : this.budget.estimatedCostPerTurn.typicalCostUsd;

    const projectedTurnsRemaining =
      avgCostPerTurn > 0 ? Math.floor(remainingUsd / avgCostPerTurn) : Infinity;

    return {
      budgetUsd: this.budgetUsd,
      percentUsed,
      projectedTurnsRemaining,
      remainingUsd,
      status,
      usedUsd,
    };
  }

  /**
   * Get session summary.
   */
  getSummary(): SessionSummary {
    const totalInputTokens = this.records.reduce(
      (sum, r) => sum + r.inputTokens,
      0
    );
    const totalOutputTokens = this.records.reduce(
      (sum, r) => sum + r.outputTokens,
      0
    );
    const totalCachedTokens = this.records.reduce(
      (sum, r) => sum + r.cachedTokens,
      0
    );
    const totalReasoningTokens = this.records.reduce(
      (sum, r) => sum + r.reasoningTokens,
      0
    );
    const totalLatency = this.records.reduce((sum, r) => sum + r.latencyMs, 0);
    const avgLatencyMs =
      this.records.length > 0 ? totalLatency / this.records.length : 0;

    return {
      avgLatencyMs,
      budgetStatus: this.getBudgetStatus(),
      endTime:
        this.records.length > 0 ? this.records.at(-1)?.timestamp : undefined,
      modelBreakdown: new Map(this.modelUsage),
      sessionId: this.sessionId,
      startTime: this.startTime,
      totalCachedTokens,
      totalCostUsd: this.totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      totalReasoningTokens,
      turnCount: this.records.length,
    };
  }

  /**
   * Get all usage records.
   */
  getRecords(): readonly UsageRecord[] {
    return this.records;
  }

  /**
   * Check if budget would be exceeded by a projected usage.
   */
  wouldExceedBudget(projectedCostUsd: number): boolean {
    if (!Number.isFinite(this.budgetUsd)) {
      return false;
    }
    return this.totalCostUsd + projectedCostUsd > this.budgetUsd;
  }

  /**
   * Estimate cost for a projected usage.
   */
  estimateCost(params: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  }): number {
    return this.calculateCost(
      params.modelId,
      params.inputTokens,
      params.outputTokens,
      params.cachedTokens ?? 0,
      params.reasoningTokens ?? 0
    );
  }

  /**
   * Format summary as human-readable string.
   */
  formatSummary(): string {
    const summary = this.getSummary();
    const formatK = (n: number) => `${(n / 1000).toFixed(1)}k`;
    const formatUsd = (n: number) => `$${n.toFixed(4)}`;

    const lines = [
      `Session: ${summary.sessionId}`,
      `Duration: ${this.formatDuration(summary.startTime, summary.endTime)}`,
      `Turns: ${summary.turnCount}`,
      ``,
      `Token Usage:`,
      `  Input:     ${formatK(summary.totalInputTokens)}`,
      `  Output:    ${formatK(summary.totalOutputTokens)}`,
      `  Cached:    ${formatK(summary.totalCachedTokens)} (${((summary.totalCachedTokens / Math.max(1, summary.totalInputTokens)) * 100).toFixed(1)}% cache hit)`,
      `  Reasoning: ${formatK(summary.totalReasoningTokens)}`,
      ``,
      `Cost: ${formatUsd(summary.totalCostUsd)}`,
      `Avg Latency: ${summary.avgLatencyMs.toFixed(0)}ms`,
      ``,
      `Budget Status: ${summary.budgetStatus.status.toUpperCase()}`,
    ];

    if (Number.isFinite(summary.budgetStatus.budgetUsd)) {
      lines.push(
        `  Used: ${formatUsd(summary.budgetStatus.usedUsd)} / ${formatUsd(summary.budgetStatus.budgetUsd)} (${summary.budgetStatus.percentUsed.toFixed(1)}%)`,
        `  Remaining: ${formatUsd(summary.budgetStatus.remainingUsd)}`,
        `  Est. turns remaining: ${summary.budgetStatus.projectedTurnsRemaining}`
      );
    }

    if (summary.modelBreakdown.size > 1) {
      lines.push(``, `Model Breakdown:`);
      for (const [modelId, usage] of summary.modelBreakdown) {
        lines.push(
          `  ${modelId}: ${usage.turnCount} turns, ${formatK(usage.inputTokens + usage.outputTokens)} tokens, ${formatUsd(usage.costUsd)}`
        );
      }
    }

    return lines.join("\n");
  }

  private formatDuration(start: Date, end?: Date): string {
    const endTime = end ?? new Date();
    const ms = endTime.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

// ============================================================================
// Global Tracker Registry
// ============================================================================

const trackers = new Map<string, UsageTracker>();

/**
 * Create or get a usage tracker for a session.
 */
export function getOrCreateTracker(config: TrackingConfig): UsageTracker {
  const existing = trackers.get(config.sessionId);
  if (existing) {
    return existing;
  }

  const tracker = new UsageTracker(config);
  trackers.set(config.sessionId, tracker);
  return tracker;
}

/**
 * Get an existing tracker.
 */
export function getTracker(sessionId: string): UsageTracker | undefined {
  return trackers.get(sessionId);
}

/**
 * Remove a tracker (on session end).
 */
export function removeTracker(sessionId: string): void {
  trackers.delete(sessionId);
}

/**
 * Get all active session IDs.
 */
export function getActiveSessions(): string[] {
  return [...trackers.keys()];
}

/**
 * Get aggregate stats across all sessions.
 */
export function getAggregateStats(): {
  activeSessions: number;
  totalCostUsd: number;
  totalTurns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
} {
  let totalCostUsd = 0;
  let totalTurns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const tracker of trackers.values()) {
    const summary = tracker.getSummary();
    totalCostUsd += summary.totalCostUsd;
    totalTurns += summary.turnCount;
    totalInputTokens += summary.totalInputTokens;
    totalOutputTokens += summary.totalOutputTokens;
  }

  return {
    activeSessions: trackers.size,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    totalTurns,
  };
}
