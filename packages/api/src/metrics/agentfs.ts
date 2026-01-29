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

// Size cap and cleanup metrics
export const agentfsCleanupDeletesTotal = new client.Counter({
  help: "Count of AgentFS cleanup deletions by type.",
  labelNames: ["type"] as const,
  name: "agentfs_cleanup_deletes_total",
  registers: [metricsRegistry],
});

export const agentfsCleanupBytesGauge = new client.Gauge({
  help: "Current bytes in AgentFS CAS storage.",
  name: "agentfs_cleanup_cas_bytes",
  registers: [metricsRegistry],
});

export const agentfsCleanupRunsBytesGauge = new client.Gauge({
  help: "Current bytes in AgentFS run directories.",
  name: "agentfs_cleanup_runs_bytes",
  registers: [metricsRegistry],
});

// CAS integrity metrics
export const agentfsCasIntegrityChecksTotal = new client.Counter({
  help: "Count of AgentFS CAS integrity checks by result.",
  labelNames: ["result"] as const,
  name: "agentfs_cas_integrity_checks_total",
  registers: [metricsRegistry],
});

export const agentfsCasIntegrityCheckDurationSeconds = new client.Histogram({
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  help: "Duration of AgentFS CAS integrity checks in seconds.",
  labelNames: ["result"] as const,
  name: "agentfs_cas_integrity_check_duration_seconds",
  registers: [metricsRegistry],
});

export const agentfsCasIntegrityQuarantinesTotal = new client.Counter({
  help: "Count of AgentFS CAS archives quarantined due to integrity failures.",
  name: "agentfs_cas_integrity_quarantines_total",
  registers: [metricsRegistry],
});

// CAS cleanup basis tracking
export const agentfsCasCleanupBasisTotal = new client.Counter({
  help: "Count of AgentFS CAS cleanup deletions by age basis.",
  labelNames: ["basis"] as const,
  name: "agentfs_cas_cleanup_basis_total",
  registers: [metricsRegistry],
});
