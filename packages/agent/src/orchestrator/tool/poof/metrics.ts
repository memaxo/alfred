import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const poofExecutionsTotal = new client.Counter({
  name: "poof_executions_total",
  help: "Count of poof isolated executions grouped by mode and status.",
  labelNames: ["mode", "status"] as const,
  registers: [metricsRegistry],
});

export const poofExecutionDurationSeconds = new client.Histogram({
  name: "poof_execution_duration_seconds",
  help: "Duration of poof isolated executions in seconds.",
  labelNames: ["mode", "profile"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

export const poofChangesTotal = new client.Counter({
  name: "poof_changes_total",
  help: "Count of file changes captured by poof isolation.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const poofChangesAppliedTotal = new client.Counter({
  name: "poof_changes_applied_total",
  help: "Count of poof changes applied to the host filesystem.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const poofTimeoutsTotal = new client.Counter({
  name: "poof_timeouts_total",
  help: "Count of poof executions that timed out.",
  labelNames: ["profile"] as const,
  registers: [metricsRegistry],
});

export const poofWorkspaceCheckpointsTotal = new client.Counter({
  name: "poof_workspace_checkpoints_total",
  help: "Count of poof workspace checkpoint operations.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

export const poofWaveHandoffConflictsTotal = new client.Counter({
  name: "poof_wave_handoff_conflicts_total",
  help: "Count of conflicts detected during poof wave handoffs.",
  registers: [metricsRegistry],
});
