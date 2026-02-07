/**
 * Enrichment System Metrics
 *
 * Tracks the effectiveness and performance of the task enrichment system.
 */

import * as client from "prom-client";

import { metricsRegistry } from "./registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Query Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const enrichmentQueriesTotal = new client.Counter({
  help: "Total enrichment queries by source type",
  labelNames: ["source", "status"] as const,
  name: "enrichment_queries_total",
  registers: [metricsRegistry],
});

export const enrichmentQueryDurationSeconds = new client.Histogram({
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  help: "Duration of enrichment queries",
  labelNames: ["source"] as const,
  name: "enrichment_query_duration_seconds",
  registers: [metricsRegistry],
});

export const enrichmentResultsCount = new client.Histogram({
  buckets: [0, 1, 2, 3, 5, 10, 20],
  help: "Number of results returned per enrichment query",
  labelNames: ["source"] as const,
  name: "enrichment_results_count",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Task Enrichment Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const tasksEnrichedTotal = new client.Counter({
  help: "Total tasks that received enrichment",
  labelNames: ["source"] as const,
  name: "enrichment_tasks_enriched_total",
  registers: [metricsRegistry],
});

export const enrichmentSourcesApplied = new client.Counter({
  help: "Count of enrichment sources applied to tasks",
  labelNames: ["source"] as const,
  name: "enrichment_sources_applied_total",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure Context Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const failureContextsCreatedTotal = new client.Counter({
  help: "Total failure contexts created",
  labelNames: ["status"] as const,
  name: "enrichment_failure_contexts_created_total",
  registers: [metricsRegistry],
});

export const failureContextToolErrors = new client.Histogram({
  buckets: [0, 1, 2, 3, 5, 10, 20],
  help: "Number of tool errors per failure context",
  name: "enrichment_failure_context_tool_errors",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Handoff Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const structuredHandoffsCreatedTotal = new client.Counter({
  help: "Total structured handoffs created between waves",
  name: "enrichment_structured_handoffs_total",
  registers: [metricsRegistry],
});

export const handoffDecisionsCount = new client.Histogram({
  buckets: [0, 1, 2, 3, 5, 10],
  help: "Number of decisions captured per handoff",
  name: "enrichment_handoff_decisions_count",
  registers: [metricsRegistry],
});

export const handoffToolsAvoidedCount = new client.Histogram({
  buckets: [0, 1, 2, 3, 5, 10],
  help: "Number of tools marked to avoid per handoff",
  name: "enrichment_handoff_tools_avoided_count",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry Resolution Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const retryResolutionsCreatedTotal = new client.Counter({
  help: "Total retry resolutions recorded (failures that were fixed)",
  name: "enrichment_retry_resolutions_total",
  registers: [metricsRegistry],
});

export const retryResolutionAttempts = new client.Histogram({
  buckets: [1, 2, 3, 4, 5],
  help: "Number of attempts before successful resolution",
  name: "enrichment_retry_resolution_attempts",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Upstream Failure Propagation Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const upstreamFailuresPropagatedTotal = new client.Counter({
  help: "Total upstream failures propagated to dependent tasks",
  name: "enrichment_upstream_failures_propagated_total",
  registers: [metricsRegistry],
});

export const tasksWithUpstreamFailures = new client.Counter({
  help: "Tasks that received upstream failure context",
  name: "enrichment_tasks_with_upstream_failures_total",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Embedding Similarity Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const embeddingSimilaritySearchTotal = new client.Counter({
  help: "Total embedding-based similarity searches",
  labelNames: ["status"] as const,
  name: "enrichment_embedding_search_total",
  registers: [metricsRegistry],
});

export const embeddingSimilarityFallbackTotal = new client.Counter({
  help: "Times embedding search fell back to keyword matching",
  name: "enrichment_embedding_fallback_total",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Live Error Streaming Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const liveErrorsEmittedTotal = new client.Counter({
  help: "Total live errors emitted during execution",
  labelNames: ["tool"] as const,
  name: "enrichment_live_errors_emitted_total",
  registers: [metricsRegistry],
});

export const liveErrorsQueriedTotal = new client.Counter({
  help: "Total live error queries by sibling agents",
  name: "enrichment_live_errors_queried_total",
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Reflection Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const reflectionLearningsPersistedTotal = new client.Counter({
  help: "Total learnings persisted by the reflection observer",
  labelNames: ["path", "outcome"] as const,
  name: "reflection_learnings_persisted_total",
  registers: [metricsRegistry],
});

export const reflectionLearningsBackfilledTotal = new client.Counter({
  help: "Total task_learning nodes that received embedding backfill",
  name: "reflection_learnings_backfilled_total",
  registers: [metricsRegistry],
});

export const reflectionPersistDurationSeconds = new client.Histogram({
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  help: "Duration of reflection persistence operations",
  labelNames: ["path"] as const,
  name: "reflection_persist_duration_seconds",
  registers: [metricsRegistry],
});
