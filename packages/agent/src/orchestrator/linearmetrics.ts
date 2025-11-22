import {
  linearActivityDurationSeconds,
  linearActivityEmissionsTotal,
  linearSessionOperationsTotal,
} from "../workflow/metrics";

export {
  linearActivityDurationSeconds,
  linearActivityEmissionsTotal,
  linearSessionOperationsTotal,
};

// Keep these types for compatibility if needed, but they are less relevant now that we export directly
export type LinearMetricsHooks = {
  linearActivityEmissionsTotal: typeof linearActivityEmissionsTotal;
  linearActivityDurationSeconds: typeof linearActivityDurationSeconds;
  linearSessionOperationsTotal: typeof linearSessionOperationsTotal;
};

export function configureLinearMetrics(
  _partial: Partial<LinearMetricsHooks>
): void {
  // No-op: Metrics are now imported directly from @alfred/agent/workflow/metrics
}

export function getLinearMetrics() {
  return {
    linearActivityEmissionsTotal,
    linearActivityDurationSeconds,
    linearSessionOperationsTotal,
  };
}
