/**
 * Metrics Registry
 *
 * Centralized metrics registration for production hardening.
 * Provides consistent metric names and recording across all systems.
 */

import { Histogram, Counter, Gauge, Registry } from "prom-client";

const register = new Registry();

export const planMetrics = {
  generationDuration: new Histogram({
    name: "plan_generation_duration_seconds",
    help: "Time to generate plan in seconds",
    buckets: [0.5, 1, 5, 10, 30, 60, 120],
    registers: [register],
  }),

  tokenCost: new Histogram({
    name: "plan_generation_cost_usd",
    help: "AI API cost per plan generation in USD",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0],
    registers: [register],
  }),

  successRate: new Gauge({
    name: "plan_generation_success_rate",
    help: "Percentage of successful plan generations",
    registers: [register],
  }),

  timeoutRate: new Counter({
    name: "plan_generation_timeout_total",
    help: "Total number of plan generation timeouts",
    registers: [register],
  }),

  errorRate: new Counter({
    name: "plan_generation_errors_total",
    help: "Total number of plan generation errors",
    labelNames: ["error_type"],
    registers: [register],
  }),
};

export const costTrackerMetrics = {
  costUsd: new Counter({
    name: "cost_tracker_cost_usd_total",
    help: "Total USD cost tracked",
    registers: [register],
  }),

  tokensUsed: new Counter({
    name: "cost_tracker_tokens_total",
    help: "Total tokens used",
    registers: [register],
  }),

  budgetAlerts: new Counter({
    name: "cost_tracker_budget_alerts_total",
    help: "Total budget alerts triggered",
    registers: [register],
  }),
};

export const warmPoolMetrics = {
  poolSize: new Gauge({
    name: "warm_pool_size",
    help: "Current size of warm container pool",
    registers: [register],
  }),

  warmupDuration: new Histogram({
    name: "warm_pool_warmup_duration_ms",
    help: "Time to warmup a container in milliseconds",
    buckets: [5000, 10000, 20000, 30000],
    registers: [register],
  }),

  poolHitRate: new Counter({
    name: "warm_pool_hit_total",
    help: "Total number of warm pool hits",
    labelNames: ["agent_type"],
    registers: [register],
  }),

  poolMissRate: new Counter({
    name: "warm_pool_miss_total",
    help: "Total number of warm pool misses",
    labelNames: ["agent_type"],
    registers: [register],
  }),
};

export const abortMetrics = {
  timeouts: new Counter({
    name: "abort_timeout_total",
    help: "Total number of operation timeouts",
    labelNames: ["operation"],
    registers: [register],
  }),

  userAborts: new Counter({
    name: "abort_user_total",
    help: "Total number of user-requested aborts",
    labelNames: ["operation"],
    registers: [register],
  }),

  abortErrors: new Counter({
    name: "abort_error_total",
    help: "Total number of abort errors",
    labelNames: ["operation"],
    registers: [register],
  }),
};

export const telemetryMetrics = {
  tuningApplied: new Counter({
    name: "telemetry_tuning_applied_total",
    help: "Total number of tuning recommendations applied",
    registers: [register],
  }),

  tuningCycleDuration: new Histogram({
    name: "telemetry_tuning_cycle_duration_ms",
    help: "Time to complete a tuning cycle",
    buckets: [1000, 5000, 10000, 30000],
    registers: [register],
  }),

  recommendationsGenerated: new Counter({
    name: "telemetry_recommendations_total",
    help: "Total tuning recommendations generated",
    registers: [register],
  }),

  recommendationsApplied: new Counter({
    name: "telemetry_recommendations_applied_total",
    help: "Total tuning recommendations applied",
    registers: [register],
  }),

  recommendationsSkipped: new Counter({
    name: "telemetry_recommendations_skipped_total",
    help: "Total tuning recommendations skipped",
    registers: [register],
  }),
};

export const visualBuilderMetrics = {
  canvasRenderTime: new Histogram({
    name: "visual_builder_canvas_render_ms",
    help: "Time to render the visual builder canvas",
    buckets: [16, 32, 64, 128, 256],
    registers: [register],
  }),

  nodeDragLatency: new Histogram({
    name: "visual_builder_node_drag_latency_ms",
    help: "Time between drag start and node position update",
    buckets: [16, 32, 64, 128, 256],
    registers: [register],
  }),

  edgeCreationTime: new Histogram({
    name: "visual_builder_edge_create_ms",
    help: "Time to create a connection edge",
    buckets: [16, 32, 64, 128, 256],
    registers: [register],
  }),

  plansCreated: new Counter({
    name: "visual_builder_plans_created_total",
    help: "Total number of plans created",
    registers: [register],
  }),

  templatesSaved: new Counter({
    name: "visual_builder_templates_saved_total",
    help: "Total number of templates saved",
    registers: [register],
  }),

  plansApproved: new Counter({
    name: "visual_builder_plans_approved_total",
    help: "Total number of plans approved",
    registers: [register],
  }),
};

export const queryHelper = {
  async getHistogramValues(
    _metricName: string,
    _startTime: Date,
    _endTime: Date
  ): Promise<number[]> {
    return [];
  },

  getQuantile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.floor(values.length * percentile);
    return values[Math.max(0, index)] || 0;
  },
};

export function getMetricsRegistry(): Registry {
  return register;
}
