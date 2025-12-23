import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const droidExecRunsTotal = new client.Counter({
  name: "droid_exec_runs_total",
  help: "Count of droid exec runs grouped by autonomy level and exit code.",
  labelNames: ["auto", "exit_code"] as const,
  registers: [metricsRegistry],
});

export const droidExecDurationSeconds = new client.Histogram({
  name: "droid_exec_duration_seconds",
  help: "Duration of droid exec runs in seconds.",
  labelNames: ["auto"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

export const droidPendingRunsGauge = new client.Gauge({
  name: "droid_pending_runs",
  help: "Current count of pending droid executions awaiting obligations.",
  registers: [metricsRegistry],
});

export const droidPendingCleanupTotal = new client.Counter({
  name: "droid_pending_cleanup_total",
  help: "Count of pending droid runs cleaned up grouped by result.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

// Hook registration for lazy wiring
let execRunsCounter: typeof droidExecRunsTotal | undefined;
let execDurationHistogram: typeof droidExecDurationSeconds | undefined;

export function registerDroidExecCounter(counter: typeof droidExecRunsTotal) {
  execRunsCounter = counter;
}

export function registerDroidExecHistogram(
  histogram: typeof droidExecDurationSeconds
) {
  execDurationHistogram = histogram;
}

export function recordDroidExecRun(auto: string, exitCode: number) {
  execRunsCounter?.inc({ auto, exit_code: String(exitCode) });
  droidExecRunsTotal.inc({ auto, exit_code: String(exitCode) });
}

export function startDroidExecTimer(auto: string) {
  const done = execDurationHistogram?.startTimer({ auto });
  const localDone = droidExecDurationSeconds.startTimer({ auto });
  return () => {
    done?.();
    localDone();
  };
}
