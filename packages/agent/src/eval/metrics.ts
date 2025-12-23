import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const evalRunsTotal = new client.Counter({
  name: "eval_runs_total",
  help: "Count of evaluation runs grouped by agent and status.",
  labelNames: ["agent", "status"] as const,
  registers: [metricsRegistry],
});

export const evalDurationSeconds = new client.Histogram({
  name: "eval_duration_seconds",
  help: "Duration of evaluation runs in seconds.",
  labelNames: ["agent"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 900, 1800],
  registers: [metricsRegistry],
});

export const evalScoresTotal = new client.Counter({
  name: "eval_scores_total",
  help: "Count of evaluation scores persisted per scorer.",
  labelNames: ["scorer"] as const,
  registers: [metricsRegistry],
});

export const evalFailuresTotal = new client.Counter({
  name: "eval_failures_total",
  help: "Count of evaluation scoring failures grouped by scorer and reason.",
  labelNames: ["scorer", "reason"] as const,
  registers: [metricsRegistry],
});

export const laminarEvalDatapointsTotal = new client.Counter({
  name: "laminar_eval_datapoints_total",
  help: "Count of Laminar datapoint operations by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const laminarEvalErrorsTotal = new client.Counter({
  name: "laminar_eval_errors_total",
  help: "Count of Laminar export errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

// Hook registration for lazy wiring
let evalRunsCounter: typeof evalRunsTotal | undefined;
let evalDurationHistogram: typeof evalDurationSeconds | undefined;
let evalScoreCounter: typeof evalScoresTotal | undefined;
let evalFailureCounter: typeof evalFailuresTotal | undefined;
let laminarDatapointCounter: typeof laminarEvalDatapointsTotal | undefined;
let laminarErrorCounter: typeof laminarEvalErrorsTotal | undefined;

export function registerEvalRunsCounter(counter: typeof evalRunsTotal) {
  evalRunsCounter = counter;
}

export function registerEvalDurationHistogram(
  histogram: typeof evalDurationSeconds
) {
  evalDurationHistogram = histogram;
}

export function registerEvalScoreCounter(counter: typeof evalScoresTotal) {
  evalScoreCounter = counter;
}

export function registerEvalFailureCounter(counter: typeof evalFailuresTotal) {
  evalFailureCounter = counter;
}

export function registerLaminarDatapointCounter(
  counter: typeof laminarEvalDatapointsTotal
) {
  laminarDatapointCounter = counter;
}

export function registerLaminarErrorCounter(
  counter: typeof laminarEvalErrorsTotal
) {
  laminarErrorCounter = counter;
}

export function recordEvalRun(agent: string, status: string) {
  evalRunsCounter?.inc({ agent, status });
  evalRunsTotal.inc({ agent, status });
}

export function startEvalTimer(agent: string) {
  const done = evalDurationHistogram?.startTimer({ agent });
  const localDone = evalDurationSeconds.startTimer({ agent });
  return () => {
    done?.();
    localDone();
  };
}

export function recordEvalScore(scorer: string) {
  evalScoreCounter?.inc({ scorer });
  evalScoresTotal.inc({ scorer });
}

export function recordEvalFailure(scorer: string, reason: string) {
  evalFailureCounter?.inc({ scorer, reason });
  evalFailuresTotal.inc({ scorer, reason });
}

export function recordLaminarDatapoint(status: string) {
  laminarDatapointCounter?.inc({ status });
  laminarEvalDatapointsTotal.inc({ status });
}

export function recordLaminarError(stage: string) {
  laminarErrorCounter?.inc({ stage });
  laminarEvalErrorsTotal.inc({ stage });
}
