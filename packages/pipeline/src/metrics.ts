/**
 * Pipeline Phase API Metrics
 *
 * Prometheus metrics for phase-level workflow operations:
 * - Plan requests and previews
 * - Phase execution durations
 * - Cache hit rates
 */

import {
  safeRegisterCounter,
  safeRegisterHistogram,
} from "@alfred/metrics/registry";

// --- Counters ---

export const phasePlanRequestsTotal = safeRegisterCounter({
  name: "pipeline_phase_plan_requests_total",
  help: "Total plan-only phase requests",
  labelNames: ["status"] as const, // success, error, cached
});

export const phasePlanPreviewsTotal = safeRegisterCounter({
  name: "pipeline_phase_previews_total",
  help: "Plans previewed but not executed",
});

export const phaseExecuteRequestsTotal = safeRegisterCounter({
  name: "pipeline_phase_execute_requests_total",
  help: "Total execute phase requests",
  labelNames: ["status"] as const, // success, error
});

export const phaseCacheHitsTotal = safeRegisterCounter({
  name: "pipeline_phase_cache_hits_total",
  help: "Plan cache hits",
  labelNames: ["result"] as const, // hit, miss
});

// --- Histograms ---

export const phasePlanDurationSeconds = safeRegisterHistogram({
  name: "pipeline_phase_plan_duration_seconds",
  help: "Duration of plan phase (init→schedule)",
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  labelNames: ["status"] as const,
});

export const phaseExecuteDurationSeconds = safeRegisterHistogram({
  name: "pipeline_phase_execute_duration_seconds",
  help: "Duration of execute phase",
  buckets: [10, 30, 60, 120, 300, 600],
  labelNames: ["status"] as const,
});

export const phaseUpdatePlanDurationSeconds = safeRegisterHistogram({
  name: "pipeline_phase_update_plan_duration_seconds",
  help: "Duration of plan update operations",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
});
