import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const agentfsIntegrityChecksTotal = new client.Counter({
  help: "Count of AgentFS sqlite integrity checks grouped by result.",
  labelNames: ["result"] as const,
  name: "agentfs_integrity_checks_total",
  registers: [metricsRegistry],
});

export const agentfsIntegrityCheckDurationSeconds = new client.Histogram({
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  help: "Duration of AgentFS sqlite integrity checks in seconds.",
  labelNames: ["result"] as const,
  name: "agentfs_integrity_check_duration_seconds",
  registers: [metricsRegistry],
});

export const agentfsIntegrityQuarantinesTotal = new client.Counter({
  help: "Count of AgentFS run quarantines triggered by integrity checks.",
  name: "agentfs_integrity_quarantines_total",
  registers: [metricsRegistry],
});

export const agentfsCompactionRunsTotal = new client.Counter({
  help: "Count of AgentFS sqlite compaction runs grouped by operation.",
  labelNames: ["op"] as const,
  name: "agentfs_compaction_runs_total",
  registers: [metricsRegistry],
});

export const agentfsCompactionDurationSeconds = new client.Histogram({
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  help: "Duration of AgentFS sqlite compaction runs in seconds.",
  labelNames: ["op"] as const,
  name: "agentfs_compaction_duration_seconds",
  registers: [metricsRegistry],
});
