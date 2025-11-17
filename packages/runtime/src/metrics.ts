/**
 * Runtime-specific Prometheus metrics
 * Registers with the shared API metrics registry
 */

import client from "prom-client";
import { metricsRegistry } from "@alfred/api/metrics";

// Workflow execution metrics

export const runtimeExecutionsTotal = new client.Counter({
  name: "runtime_executions_total",
  help: "Total runtime executions by autonomy level and status",
  labelNames: ["auto", "status"] as const,
  registers: [metricsRegistry],
});

export const runtimeExecutionDurationSeconds = new client.Histogram({
  name: "runtime_execution_duration_seconds",
  help: "Duration of complete runtime executions in seconds",
  labelNames: ["auto", "status"] as const,
  buckets: [0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [metricsRegistry],
});

// Phase execution metrics

export const runtimePhasesTotal = new client.Counter({
  name: "runtime_phases_total",
  help: "Total phase executions by phase name and status",
  labelNames: ["phase", "status"] as const,
  registers: [metricsRegistry],
});

export const runtimePhaseDurationSeconds = new client.Histogram({
  name: "runtime_phase_duration_seconds",
  help: "Duration of runtime phases in seconds",
  labelNames: ["phase"] as const,
  buckets: [0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [metricsRegistry],
});

// Context build metrics

export const runtimeContextBuildDurationSeconds = new client.Histogram({
  name: "runtime_context_build_duration_seconds",
  help: "Duration of context builds in seconds",
  labelNames: ["cached"] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const runtimeContextCacheHitsTotal = new client.Counter({
  name: "runtime_context_cache_hits_total",
  help: "Count of context cache hits and misses",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const runtimeContextTokensTotal = new client.Counter({
  name: "runtime_context_tokens_total",
  help: "Token counts by type (requirement, tools, overhead, context)",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

// AI SDK metrics

export const runtimeAiSdkCallsTotal = new client.Counter({
  name: "runtime_ai_sdk_calls_total",
  help: "Count of AI SDK calls by model and status",
  labelNames: ["model", "status"] as const,
  registers: [metricsRegistry],
});

export const runtimeAiSdkDurationSeconds = new client.Histogram({
  name: "runtime_ai_sdk_duration_seconds",
  help: "Duration of AI SDK calls in seconds",
  labelNames: ["model"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

export const runtimeAiEventsTotal = new client.Counter({
  name: "runtime_ai_events_total",
  help: "Count of AI SDK events by event type",
  labelNames: ["event_type"] as const,
  registers: [metricsRegistry],
});

// Knowledge persistence metrics

export const runtimeKnowledgeUpdatesTotal = new client.Counter({
  name: "runtime_knowledge_updates_total",
  help: "Count of knowledge updates by type and status",
  labelNames: ["type", "status"] as const,
  registers: [metricsRegistry],
});

export const runtimeKnowledgeBatchDurationSeconds = new client.Histogram({
  name: "runtime_knowledge_batch_duration_seconds",
  help: "Duration of knowledge batch operations in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

