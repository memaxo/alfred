type ActivityCounter = {
  inc: (labels: { type: string; status: string }) => void;
};

type ActivityDuration = {
  startTimer: (labels: { type: string }) => () => void;
};

type SessionCounter = {
  inc: (labels: { operation: string }) => void;
};

export type LinearMetricsHooks = {
  linearActivityEmissionsTotal: ActivityCounter;
  linearActivityDurationSeconds: ActivityDuration;
  linearSessionOperationsTotal: SessionCounter;
};

const noopActivityCounter: ActivityCounter = {
  inc: () => {},
};

const noopDuration: ActivityDuration = {
  startTimer: () => () => {},
};

const noopSessionCounter: SessionCounter = {
  inc: () => {},
};

let metrics: LinearMetricsHooks = {
  linearActivityEmissionsTotal: noopActivityCounter,
  linearActivityDurationSeconds: noopDuration,
  linearSessionOperationsTotal: noopSessionCounter,
};

export function configureLinearMetrics(
  partial: Partial<LinearMetricsHooks>
): void {
  metrics = {
    linearActivityEmissionsTotal:
      partial.linearActivityEmissionsTotal ??
      metrics.linearActivityEmissionsTotal,
    linearActivityDurationSeconds:
      partial.linearActivityDurationSeconds ??
      metrics.linearActivityDurationSeconds,
    linearSessionOperationsTotal:
      partial.linearSessionOperationsTotal ??
      metrics.linearSessionOperationsTotal,
  };
}

export function getLinearMetrics(): LinearMetricsHooks {
  return metrics;
}
