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

// ============================================================================
// Budget Metrics (used by @alfred/agent budget manager)
// ============================================================================

export const budgetUsageGauge = new client.Gauge({
  name: "alfred_budget_usage_ratio",
  help: "Current budget usage ratio (0-1).",
  labelNames: ["userId", "type"] as const, // type: "dollar" | "token"
  registers: [metricsRegistry],
});

export const budgetExceededTotal = new client.Counter({
  name: "alfred_budget_exceeded_total",
  help: "Count of requests blocked due to budget.",
  labelNames: ["reason"] as const, // reason: "daily_dollar" | "daily_token" | "request_limit"
  registers: [metricsRegistry],
});

export const budgetUsageRecordedTotal = new client.Counter({
  name: "alfred_budget_usage_recorded_total",
  help: "Count of usage records created.",
  labelNames: ["provider", "role"] as const,
  registers: [metricsRegistry],
});

export const budgetCostCentsTotal = new client.Counter({
  name: "alfred_budget_cost_cents_total",
  help: "Total cost in cents across all users.",
  labelNames: ["provider", "role"] as const,
  registers: [metricsRegistry],
});

export const budgetTokensTotal = new client.Counter({
  name: "alfred_budget_tokens_total",
  help: "Total tokens used across all users.",
  labelNames: ["provider", "role", "type"] as const, // type: "input" | "output" | "cached"
  registers: [metricsRegistry],
});

// ============================================================================
// Idle Loop Metrics (used by @alfred/api idle-loop scheduler)
// ============================================================================

export const idleLoopTasksProcessedTotal = new client.Counter({
  name: "alfred_idle_loop_tasks_processed_total",
  help: "Count of tasks processed during idle time.",
  labelNames: ["type", "status"] as const, // type: task type, status: "completed" | "failed"
  registers: [metricsRegistry],
});

export const idleLoopTaskDurationMs = new client.Histogram({
  name: "alfred_idle_loop_task_duration_ms",
  help: "Duration of idle loop task processing in milliseconds.",
  buckets: [10, 50, 100, 500, 1000, 5000, 10_000, 30_000],
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const idleLoopCycleTotal = new client.Counter({
  name: "alfred_idle_loop_cycle_total",
  help: "Count of idle loop cycles executed.",
  registers: [metricsRegistry],
});

export const idleLoopUsersProcessedTotal = new client.Counter({
  name: "alfred_idle_loop_users_processed_total",
  help: "Count of users processed in idle loop.",
  registers: [metricsRegistry],
});

export const idleLoopQueueDepth = new client.Gauge({
  name: "alfred_idle_loop_queue_depth",
  help: "Current number of pending tasks in the queue.",
  labelNames: ["status"] as const, // status: "pending" | "running"
  registers: [metricsRegistry],
});

// ============================================================================
// Model Selection Metrics (used by @alfred/agent selector)
// ============================================================================

export const modelSelectionTotal = new client.Counter({
  name: "alfred_model_selection_total",
  help: "Count of model selections by role and provider.",
  labelNames: ["role", "provider", "reason"] as const, // reason: "user_pref" | "budget" | "latency" | "env" | "fallback"
  registers: [metricsRegistry],
});

export const modelSelectionFallbackTotal = new client.Counter({
  name: "alfred_model_selection_fallback_total",
  help: "Count of model selection fallbacks due to budget or latency constraints.",
  labelNames: [
    "role",
    "originalProvider",
    "fallbackProvider",
    "reason",
  ] as const,
  registers: [metricsRegistry],
});

export const modelLatencyMs = new client.Histogram({
  name: "alfred_model_latency_ms",
  help: "Actual latency of model requests in milliseconds.",
  buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 30_000],
  labelNames: ["provider", "role"] as const,
  registers: [metricsRegistry],
});

export const modelProviderAvailability = new client.Gauge({
  name: "alfred_model_provider_availability",
  help: "Whether a model provider is available (1) or not (0).",
  labelNames: ["provider"] as const, // provider: "cerebras" | "openrouter" | "gateway"
  registers: [metricsRegistry],
});

// ============================================================================
// Cognitive Bridge Metrics (used by @alfred/api cognitive-bridge)
// ============================================================================

export const cognitiveBridgeTriggerTotal = new client.Counter({
  name: "alfred_cognitive_bridge_trigger_total",
  help: "Count of cognitive bridge triggers by source.",
  labelNames: ["source", "action"] as const, // action: "immediate" | "queued" | "dropped"
  registers: [metricsRegistry],
});

export const cognitiveBridgeProcessingMs = new client.Histogram({
  name: "alfred_cognitive_bridge_processing_ms",
  help: "Duration of cognitive bridge processing in milliseconds.",
  buckets: [10, 50, 100, 500, 1000, 5000],
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// Personality Metrics (used by @alfred/cognitive personality)
// ============================================================================

export const personalityTraitUpdateTotal = new client.Counter({
  name: "alfred_personality_trait_update_total",
  help: "Count of personality trait updates.",
  labelNames: ["trait", "eventType"] as const,
  registers: [metricsRegistry],
});

export const personalityCalibrationAccuracy = new client.Gauge({
  name: "alfred_personality_calibration_accuracy",
  help: "Current calibration accuracy for a domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});
