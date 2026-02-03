import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

function getOrCreateCounter<const Labels extends readonly string[]>(args: {
  name: string;
  help: string;
  labelNames: Labels;
}): client.Counter<Labels[number]> {
  const existing = metricsRegistry.getSingleMetric(args.name);
  if (existing) {
    if (existing instanceof client.Counter) {
      return existing as client.Counter<Labels[number]>;
    }
    throw new Error(`metric_name_conflict:${args.name}`);
  }
  return new client.Counter({
    help: args.help,
    labelNames: args.labelNames,
    name: args.name,
    registers: [metricsRegistry],
  });
}

function getOrCreateHistogram<const Labels extends readonly string[]>(args: {
  name: string;
  help: string;
  labelNames: Labels;
  buckets: number[];
}): client.Histogram<Labels[number]> {
  const existing = metricsRegistry.getSingleMetric(args.name);
  if (existing) {
    if (existing instanceof client.Histogram) {
      return existing as client.Histogram<Labels[number]>;
    }
    throw new Error(`metric_name_conflict:${args.name}`);
  }
  return new client.Histogram({
    buckets: args.buckets,
    help: args.help,
    labelNames: args.labelNames,
    name: args.name,
    registers: [metricsRegistry],
  });
}

export const codexExecRunsTotal = getOrCreateCounter({
  name: "codex_exec_runs_total",
  help: "Count of Codex exec runs grouped by autonomy level and exit code.",
  labelNames: ["auto", "exit_code"] as const,
});

export const codexExecDurationSeconds = getOrCreateHistogram({
  name: "codex_exec_duration_seconds",
  help: "Duration of Codex exec runs in seconds.",
  labelNames: ["auto"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
});

export const codexErrorsTotal = getOrCreateCounter({
  name: "codex_errors_total",
  help: "Count of Codex executor errors grouped by stage.",
  labelNames: ["stage"] as const,
});

export const codexSessionValidationDurationSeconds = getOrCreateHistogram({
  name: "codex_session_validation_duration_seconds",
  help: "Duration spent validating whether a Codex session can resume.",
  labelNames: ["outcome"] as const,
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
});

export const codexSessionContinuityTotal = getOrCreateCounter({
  name: "codex_session_continuity_total",
  help: "Count of Codex session continuity events (resume success/failure).",
  labelNames: ["status"] as const,
});

export const codexStructuredOutputValidationTotal = getOrCreateCounter({
  name: "codex_structured_output_validation_total",
  help: "Count of structured output validation results.",
  labelNames: ["status"] as const,
});

export const codexLinearIntegrationLatencySeconds = getOrCreateHistogram({
  name: "codex_linear_integration_latency_seconds",
  help: "Latency from Codex event emission to Linear activity creation.",
  labelNames: ["event_type"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const codexLinearActivitiesEmittedTotal = getOrCreateCounter({
  name: "codex_linear_activities_emitted_total",
  help: "Count of Codex-originated Linear activities grouped by type and mode.",
  labelNames: ["type", "mode"] as const,
});

export const codexLinearActivitiesDroppedTotal = getOrCreateCounter({
  name: "codex_linear_activities_dropped_total",
  help: "Count of Codex events dropped due to rate limiting grouped by reason.",
  labelNames: ["reason"] as const,
});

export const codexLinearActivityBatchesTotal = getOrCreateCounter({
  name: "codex_linear_activity_batches_total",
  help: "Count of Codex Linear batch processing outcomes grouped by status.",
  labelNames: ["status"] as const,
});

// Hook registration for lazy wiring
let execRunsCounter: typeof codexExecRunsTotal | undefined;
let execDurationHistogram: typeof codexExecDurationSeconds | undefined;
let errorsCounter: typeof codexErrorsTotal | undefined;
let sessionValidationHistogram:
  | {
      startTimer: () => (labels: { outcome: string }) => void;
    }
  | undefined;

export function registerCodexExecCounter(counter: typeof codexExecRunsTotal) {
  execRunsCounter = counter;
}

export function registerCodexExecHistogram(
  histogram: typeof codexExecDurationSeconds
) {
  execDurationHistogram = histogram;
}

export function registerCodexErrorCounter(counter: typeof codexErrorsTotal) {
  errorsCounter = counter;
}

export function registerCodexSessionValidationHistogram(histogram: {
  startTimer: () => (labels: { outcome: string }) => void;
}) {
  sessionValidationHistogram = histogram;
}

export function recordCodexExecRun(auto: string, exitCode: number) {
  execRunsCounter?.inc({ auto, exit_code: String(exitCode) });
  codexExecRunsTotal.inc({ auto, exit_code: String(exitCode) });
}

export function startCodexExecTimer(auto: string) {
  const done = execDurationHistogram?.startTimer({ auto });
  const localDone = codexExecDurationSeconds.startTimer({ auto });
  return () => {
    done?.();
    localDone();
  };
}

export function recordCodexError(stage: string) {
  errorsCounter?.inc({ stage });
  codexErrorsTotal.inc({ stage });
}

export function startSessionValidationTimer() {
  const externalDone = sessionValidationHistogram?.startTimer();
  const localDone = codexSessionValidationDurationSeconds.startTimer();
  return (outcome: string) => {
    externalDone?.({ outcome });
    localDone({ outcome });
  };
}
