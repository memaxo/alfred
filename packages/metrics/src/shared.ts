/**
 * Shared metrics used across multiple packages.
 * These are defined here to avoid circular dependencies.
 */

import client from "prom-client";
import { metricsRegistry } from "./registry";

// Redis metrics (used by @alfred/auth)
export const redisConnectionStatus = new client.Gauge({
  name: "redis_connection_status",
  help: "Redis connection status (0=disconnected, 1=connected).",
  registers: [metricsRegistry],
});

export const redisConnectionErrorsTotal = new client.Counter({
  name: "redis_connection_errors_total",
  help: "Count of Redis connection errors.",
  registers: [metricsRegistry],
});

export const redisReconnectionAttemptsTotal = new client.Counter({
  name: "redis_reconnection_attempts_total",
  help: "Count of Redis reconnection attempts.",
  registers: [metricsRegistry],
});

// Entity linking metrics (used by @alfred/agent)
export const entityLinkingDurationMs = new client.Histogram({
  name: "entity_linking_duration_ms",
  help: "Duration of entity linking in milliseconds.",
  buckets: [1, 5, 10, 20, 50, 100, 200, 500],
  registers: [metricsRegistry],
});

export const entityLinkingFallbackTotal = new client.Counter({
  name: "entity_linking_fallback_total",
  help: "Count of entity linking fallback events (embedding failure).",
  registers: [metricsRegistry],
});

// Cognitive physiology metrics (used by @alfred/runtime)
export const cognitivePhysiologyGauge = new client.Gauge({
  name: "cognitive_physiology_gauge",
  help: "Current values of cognitive physiology metrics.",
  labelNames: ["metric"] as const,
  registers: [metricsRegistry],
});

export const cognitiveEntropyEventsTotal = new client.Counter({
  name: "cognitive_entropy_events_total",
  help: "Count of entropy events (high/low) triggered by the Supervisor.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const cognitiveFeedbackSubmissionsTotal = new client.Counter({
  name: "cognitive_feedback_submissions_total",
  help: "Count of cognitive feedback submissions grouped by surface.",
  labelNames: ["surface"] as const,
  registers: [metricsRegistry],
});

// Codex metrics (used by @alfred/agent)
export const codexSessionValidationTimeoutTotal = new client.Counter({
  name: "codex_session_validation_timeout_total",
  help: "Count of Codex session validation timeouts.",
  registers: [metricsRegistry],
});

// Memory maintenance metrics (used by @alfred/agent learning worker)
export const memoryMaintenanceDurationSeconds = new client.Histogram({
  name: "alfred_memory_maintenance_duration_seconds",
  help: "Duration of memory maintenance cycles in seconds.",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const memoryNodesDecayedTotal = new client.Counter({
  name: "alfred_memory_nodes_decayed_total",
  help: "Count of memory nodes that had their confidence decayed.",
  registers: [metricsRegistry],
});

export const memoryNodesPrunedTotal = new client.Counter({
  name: "alfred_memory_nodes_pruned_total",
  help: "Count of memory nodes archived due to low confidence.",
  registers: [metricsRegistry],
});

export const memoryNodesCleanedTotal = new client.Counter({
  name: "alfred_memory_nodes_cleaned_total",
  help: "Count of archived memory nodes permanently deleted.",
  registers: [metricsRegistry],
});

// Decomposition metrics (used by @alfred/agent multi)
export const decompositionTruncatedTotal = new client.Counter({
  name: "decomposition_truncated_total",
  help: "Count of task decomposition truncations grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

// Linear rate limit metrics (used by @alfred/agent)
export const linearRateLimitTotal = new client.Counter({
  name: "linear_rate_limit_total",
  help: "Total Linear rate limit hits grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const linearRateLimitWaitSeconds = new client.Histogram({
  name: "linear_rate_limit_wait_seconds",
  help: "Time spent waiting due to Linear rate limiting in seconds.",
  buckets: [0.1, 0.5, 1, 5, 10, 30],
  registers: [metricsRegistry],
});

export const linearRateLimitRetryAfterTotal = new client.Counter({
  name: "linear_rate_limit_retry_after_total",
  help: "Count of times Retry-After header was honored for Linear rate limiting.",
  registers: [metricsRegistry],
});
