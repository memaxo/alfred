/**
 * AgentFS Prometheus metrics for observability.
 *
 * Replaces poof metrics from packages/agent/src/orchestrator/tool/poof/metrics.ts
 */

import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

/**
 * Count of AgentFS workspace executions.
 * Labels:
 * - status: "success" | "failed" | "timeout"
 * - overlay: "true" | "false"
 */
export const agentfsExecutionsTotal = new client.Counter({
  name: "agentfs_executions_total",
  help: "Count of AgentFS workspace executions.",
  labelNames: ["status", "overlay"] as const,
  registers: [metricsRegistry],
});

/**
 * Count of tool calls recorded to AgentFS.
 * Labels:
 * - tool_name: Name of the tool
 * - status: "success" | "error"
 */
export const agentfsToolCallsTotal = new client.Counter({
  name: "agentfs_tool_calls_total",
  help: "Count of tool calls recorded to AgentFS.",
  labelNames: ["tool_name", "status"] as const,
  registers: [metricsRegistry],
});

/**
 * Size of AgentFS database files in bytes.
 * Labels:
 * - run_id: Workflow run identifier
 */
export const agentfsDbSizeBytes = new client.Gauge({
  name: "agentfs_db_size_bytes",
  help: "Size of AgentFS database files in bytes.",
  labelNames: ["run_id"] as const,
  registers: [metricsRegistry],
});

/**
 * Count of AgentFS filesystem operations.
 * Labels:
 * - operation: "read" | "write" | "delete" | "mkdir" | "readdir" | "stat"
 */
export const agentfsFilesystemOpsTotal = new client.Counter({
  name: "agentfs_filesystem_ops_total",
  help: "Count of AgentFS filesystem operations.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

/**
 * Count of AgentFS checkpoint operations.
 * Labels:
 * - operation: "create" | "restore"
 */
export const agentfsCheckpointsTotal = new client.Counter({
  name: "agentfs_checkpoints_total",
  help: "Count of AgentFS checkpoint operations.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

/**
 * Duration of AgentFS command executions in seconds.
 * Labels:
 * - command_type: Type of command executed
 */
export const agentfsExecutionDurationSeconds = new client.Histogram({
  name: "agentfs_execution_duration_seconds",
  help: "Duration of AgentFS command executions in seconds.",
  labelNames: ["command_type"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

/**
 * Count of AgentFS key-value operations.
 * Labels:
 * - operation: "get" | "set" | "delete" | "list"
 */
export const agentfsKvOpsTotal = new client.Counter({
  name: "agentfs_kv_ops_total",
  help: "Count of AgentFS key-value store operations.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

/**
 * Latency of AgentFS operations in milliseconds.
 * Labels:
 * - operation_type: "fs" | "kv" | "tools" | "checkpoint"
 */
export const agentfsOperationLatencyMs = new client.Histogram({
  name: "agentfs_operation_latency_ms",
  help: "Latency of AgentFS operations in milliseconds.",
  labelNames: ["operation_type"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

/**
 * Active AgentFS workspaces gauge.
 */
export const agentfsActiveWorkspaces = new client.Gauge({
  name: "agentfs_active_workspaces",
  help: "Number of currently active AgentFS workspaces.",
  registers: [metricsRegistry],
});

/**
 * Count of learning bridge extractions from AgentFS.
 * Labels:
 * - type: "patterns" | "mistakes" | "insights"
 */
export const agentfsLearningExtractionsTotal = new client.Counter({
  name: "agentfs_learning_extractions_total",
  help: "Count of learning system extractions from AgentFS.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});
