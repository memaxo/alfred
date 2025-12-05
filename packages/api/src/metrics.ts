// External metric hooks (agent/policy) are wired lazily below to keep tests light

import { logger } from "@alfred/logger";
import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export { metricsRegistry };
export {
  fineTuneRunDurationSeconds,
  fineTuneRunsTotal,
  fineTuneSamplesTotal,
  fineTuneTokensTotal,
} from "@alfred/tune";

const metricsRegistryPatchKey = Symbol.for("alfred.metrics.registry.dedupe");

if (
  !(globalThis as Record<string | symbol, unknown>)[metricsRegistryPatchKey]
) {
  const originalRegisterMetric =
    metricsRegistry.registerMetric.bind(metricsRegistry);

  const patchedRegisterMetric: typeof metricsRegistry.registerMetric = (
    metric
  ) => {
    const existing = metricsRegistry.getSingleMetric((metric as any).name);
    if (existing && existing !== metric) {
      metricsRegistry.removeSingleMetric((metric as any).name);
    }
    return originalRegisterMetric(metric);
  };

  metricsRegistry.registerMetric = patchedRegisterMetric;
  (globalThis as Record<string | symbol, unknown>)[metricsRegistryPatchKey] =
    true;
}

export const trpcRequestsTotal = new client.Counter({
  name: "trpc_requests_total",
  help: "Count of tRPC requests by procedure and type.",
  labelNames: ["procedure", "type"] as const,
  registers: [metricsRegistry],
});

export const trpcRequestErrorsTotal = new client.Counter({
  name: "trpc_request_errors_total",
  help: "Count of failed tRPC requests by procedure, type, and code.",
  labelNames: ["procedure", "type", "code"] as const,
  registers: [metricsRegistry],
});

export const trpcRequestDurationSeconds = new client.Histogram({
  name: "trpc_request_duration_seconds",
  help: "Duration of tRPC requests in seconds.",
  labelNames: ["procedure", "type"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const healthChecksTotal = new client.Counter({
  name: "health_checks_total",
  help: "Count of health check invocations by target and status.",
  labelNames: ["target", "status"] as const,
  registers: [metricsRegistry],
});

export const policyDecisionsTotal = new client.Counter({
  name: "policy_decisions_total",
  help: "Count of policy decisions grouped by action and decision.",
  labelNames: ["action", "decision"] as const,
  registers: [metricsRegistry],
});

export const policyObligationsTotal = new client.Counter({
  name: "policy_obligations_total",
  help: "Count of policy obligations emitted by action.",
  labelNames: ["action", "obligation"] as const,
  registers: [metricsRegistry],
});

export const workflowObligationSuspensionsTotal = new client.Counter({
  name: "workflow_obligation_suspensions_total",
  help: "Count of workflow suspensions grouped by transport, result, and obligation type.",
  labelNames: ["transport", "result", "obligation"] as const,
  registers: [metricsRegistry],
});

export const workflowObligationDurationSeconds = new client.Histogram({
  name: "workflow_obligation_duration_seconds",
  help: "Duration of workflow suspensions grouped by transport and result.",
  labelNames: ["transport", "result"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

export const workflowSuspensionCleanupTotal = new client.Counter({
  name: "workflow_suspension_cleanup_total",
  help: "Count of workflow suspensions cleaned up grouped by result.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export {
  linearActivityDurationSeconds,
  linearActivityEmissionsTotal,
  linearSessionOperationsTotal,
  linearWebhookEventsTotal,
  linearWebhookWorkflowCancelsTotal,
  linearWebhookWorkflowStartsTotal,
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
  replayQueriesTotal,
  replayQueryDurationSeconds,
  runnerErrorsTotal,
  runnerStepsTotal,
  runRegistryDispatchDurationSeconds,
  runRegistryEventsTotal,
  workflowProvenanceDurationSeconds,
  workflowProvenanceEdgesTotal,
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "@alfred/agent/workflow/metrics";

// decompositionTruncatedTotal, linearRateLimitTotal, linearRateLimitWaitSeconds,
// linearRateLimitRetryAfterTotal are now in @alfred/metrics/shared and re-exported below

export const graphQueriesTotal = new client.Counter({
  name: "graph_queries_total",
  help: "Count of graph queries grouped by kind and resource.",
  labelNames: ["kind", "resource"] as const,
  registers: [metricsRegistry],
});

export const graphQueryDurationSeconds = new client.Histogram({
  name: "graph_query_duration_seconds",
  help: "Duration of graph queries in seconds grouped by kind.",
  labelNames: ["kind"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const graphRagHitsTotal = new client.Counter({
  name: "graph_rag_hits_total",
  help: "Count of active RAG hits grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const graphRagEmptyTotal = new client.Counter({
  name: "graph_rag_empty_total",
  help: "Count of active RAG queries that returned zero results.",
  registers: [metricsRegistry],
});

export const graphContextDurationSeconds = new client.Histogram({
  name: "graph_context_duration_seconds",
  help: "Duration of context graph queries (Active RAG) in seconds.",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const pdpCacheHitsTotal = new client.Counter({
  name: "pdp_cache_hits_total",
  help: "Count of policy cache hits and misses.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const droidExecRunsTotal = new client.Counter({
  name: "droid_exec_runs_total",
  help: "Count of droid exec runs grouped by autonomy level and exit code.",
  labelNames: ["auto", "exit_code"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

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

// wired via lazy hooks

export const codexExecRunsTotal = new client.Counter({
  name: "codex_exec_runs_total",
  help: "Count of Codex exec runs grouped by autonomy level and exit code.",
  labelNames: ["auto", "exit_code"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const codexExecDurationSeconds = new client.Histogram({
  name: "codex_exec_duration_seconds",
  help: "Duration of Codex exec runs in seconds.",
  labelNames: ["auto"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const codexErrorsTotal = new client.Counter({
  name: "codex_errors_total",
  help: "Count of Codex executor errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

export const codexSessionValidationDurationSeconds = new client.Histogram({
  name: "codex_session_validation_duration_seconds",
  help: "Duration spent validating whether a Codex session can resume.",
  labelNames: ["outcome"] as const,
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
  registers: [metricsRegistry],
});

// codexSessionValidationTimeoutTotal is now in @alfred/metrics/shared and re-exported below

export const codexSessionContinuityTotal = new client.Counter({
  name: "codex_session_continuity_total",
  help: "Count of Codex session continuity events (resume success/failure).",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const codexStructuredOutputValidationTotal = new client.Counter({
  name: "codex_structured_output_validation_total",
  help: "Count of structured output validation results.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const codexLinearIntegrationLatencySeconds = new client.Histogram({
  name: "codex_linear_integration_latency_seconds",
  help: "Latency from Codex event emission to Linear activity creation.",
  labelNames: ["event_type"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const codexLinearActivitiesEmittedTotal = new client.Counter({
  name: "codex_linear_activities_emitted_total",
  help: "Count of Codex-originated Linear activities grouped by type and mode.",
  labelNames: ["type", "mode"] as const,
  registers: [metricsRegistry],
});

export const codexLinearActivitiesDroppedTotal = new client.Counter({
  name: "codex_linear_activities_dropped_total",
  help: "Count of Codex events dropped due to rate limiting grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const voiceWebSocketConnectionsCurrent = new client.Gauge({
  name: "voice_websocket_connections_current",
  help: "Current active WebSocket connections for voice streaming.",
  registers: [metricsRegistry],
});

export const voiceWebSocketSendFailuresTotal = new client.Counter({
  name: "voice_websocket_send_failures_total",
  help: "Total WebSocket send failures grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const voiceWebSocketUpgradeRateLimitHitsTotal = new client.Counter({
  name: "voice_websocket_upgrade_rate_limit_hits_total",
  help: "Count of WebSocket upgrade requests rejected due to rate limiting.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const voiceWebSocketConnectionRejectedTotal = new client.Counter({
  name: "voice_websocket_connection_rejected_total",
  help: "Count of WebSocket connections rejected due to limits.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const voiceWebSocketMessageLatencySeconds = new client.Histogram({
  name: "voice_websocket_message_latency_seconds",
  help: "Latency of WebSocket message processing in seconds.",
  labelNames: ["message_type"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const voiceWebSocketBinaryChunkSizeBytes = new client.Histogram({
  name: "voice_websocket_binary_chunk_size_bytes",
  help: "Size of binary audio chunks received via WebSocket.",
  buckets: [256, 512, 1024, 2048, 4096, 8192, 16_384, 32_768, 65_536],
  registers: [metricsRegistry],
});

export const voiceWebSocketUpgradeDurationSeconds = new client.Histogram({
  name: "voice_websocket_upgrade_duration_seconds",
  help: "Duration of WebSocket upgrade process in seconds.",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const voiceWebSocketBackpressureEventsTotal = new client.Counter({
  name: "voice_websocket_backpressure_events_total",
  help: "Count of backpressure events on WebSocket connections.",
  registers: [metricsRegistry],
});

export const voiceWebSocketPingTimeoutTotal = new client.Counter({
  name: "voice_websocket_ping_timeout_total",
  help: "Count of WebSocket connections closed due to ping timeout.",
  registers: [metricsRegistry],
});

export const voiceWebSocketPayloadTooLargeTotal = new client.Counter({
  name: "voice_websocket_payload_too_large_total",
  help: "Count of WebSocket messages rejected due to payload size limit.",
  registers: [metricsRegistry],
});

export const codexLinearActivityBatchesTotal = new client.Counter({
  name: "codex_linear_activity_batches_total",
  help: "Count of Codex Linear batch processing outcomes grouped by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const evalRunsTotal = new client.Counter({
  name: "eval_runs_total",
  help: "Count of evaluation runs grouped by agent and status.",
  labelNames: ["agent", "status"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const evalDurationSeconds = new client.Histogram({
  name: "eval_duration_seconds",
  help: "Duration of evaluation runs in seconds.",
  labelNames: ["agent"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 900, 1800],
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const evalScoresTotal = new client.Counter({
  name: "eval_scores_total",
  help: "Count of evaluation scores persisted per scorer.",
  labelNames: ["scorer"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const evalFailuresTotal = new client.Counter({
  name: "eval_failures_total",
  help: "Count of evaluation scoring failures grouped by scorer and reason.",
  labelNames: ["scorer", "reason"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const laminarEvalDatapointsTotal = new client.Counter({
  name: "laminar_eval_datapoints_total",
  help: "Count of Laminar datapoint operations by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const laminarEvalErrorsTotal = new client.Counter({
  name: "laminar_eval_errors_total",
  help: "Count of Laminar export errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const compressionCyclesTotal = new client.Counter({
  name: "compression_cycles_total",
  help: "Count of compression worker cycles grouped by outcome.",
  labelNames: ["outcome"] as const,
  registers: [metricsRegistry],
});

export const mindscapeRagCacheEventsTotal = new client.Counter({
  name: "mindscape_rag_cache_events_total",
  help: "Count of Mindscape RAG cache events grouped by event type.",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const compressionCycleDurationSeconds = new client.Histogram({
  name: "compression_cycle_duration_seconds",
  help: "Duration of compression worker cycles in seconds grouped by outcome.",
  labelNames: ["outcome"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const compressionNodesUpdatedTotal = new client.Counter({
  name: "compression_nodes_updated_total",
  help: "Count of nodes updated by the compression worker grouped by operation.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const webhookEventsTotal = new client.Counter({
  name: "webhook_events_total",
  help: "Count of webhook events grouped by type.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const webhookErrorsTotal = new client.Counter({
  name: "webhook_errors_total",
  help: "Count of webhook handler errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

export const rateLimitHitsTotal = new client.Counter({
  name: "rate_limit_hits_total",
  help: "Count of rate limit hits grouped by procedure.",
  labelNames: ["procedure"] as const,
  registers: [metricsRegistry],
});

export const assistantToolCallsTotal = new client.Counter({
  name: "assistant_tool_calls_total",
  help: "Count of assistant tool invocations grouped by tool name.",
  labelNames: ["tool"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks
export const assistantEscalationsTotal = new client.Counter({
  name: "assistant_escalations_total",
  help: "Count of assistant escalations grouped by kind.",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const policyCheckFailuresTotal = new client.Counter({
  name: "policy_check_failures_total",
  help: "Count of tool policy enforcement failures grouped by tool.",
  labelNames: ["tool"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const memoryUpdatesTotal = new client.Counter({
  name: "memory_updates_total",
  help: "Count of memory updates grouped by kind and source.",
  labelNames: ["kind", "source"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const memoryForgetsTotal = new client.Counter({
  name: "memory_forgets_total",
  help: "Count of memory forget operations grouped by scope.",
  labelNames: ["scope"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

export const preferenceHistoryPrunedTotal = new client.Counter({
  name: "preference_history_pruned_total",
  help: "Count of preference history prune events grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const preferenceCacheInvalidationsTotal = new client.Counter({
  name: "preference_cache_invalidations_total",
  help: "Count of preference cache invalidations grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const preferenceRefreshTotal = new client.Counter({
  name: "preference_refresh_total",
  help: "Count of preference refresh triggers grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptInjectionsTotal = new client.Counter({
  name: "preference_prompt_injections_total",
  help: "Count of preference prompt injections grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptFailuresTotal = new client.Counter({
  name: "preference_prompt_failures_total",
  help: "Count of preference prompt build failures grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

/**
 * Classification metrics for emergent learning system
 * Tracks source of domain classifications (learned vs static vs seed)
 */
export const classificationSourceTotal = new client.Counter({
  name: "alfred_classification_source_total",
  help: "Count of domain classifications grouped by domain and source.",
  labelNames: ["domain", "source"] as const,
  registers: [metricsRegistry],
});

/**
 * Classification accuracy tracking
 * Tracks user confirmations vs corrections for learning effectiveness
 */
export const classificationAccuracyTotal = new client.Counter({
  name: "alfred_classification_accuracy_total",
  help: "Count of classification outcomes (confirmed vs corrected).",
  labelNames: ["domain", "outcome"] as const,
  registers: [metricsRegistry],
});

/**
 * Classification latency histogram
 * Tracks performance of domain classification operations
 */
export const classificationDurationSeconds = new client.Histogram({
  name: "alfred_classification_duration_seconds",
  help: "Duration of domain classification operations in seconds.",
  labelNames: ["method"] as const,
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

/**
 * Domain cache statistics
 * Tracks cache hits/misses for learned domain associations
 */
export const domainCacheHitsTotal = new client.Counter({
  name: "alfred_domain_cache_hits_total",
  help: "Count of domain cache hits and misses.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const redisCommandsTotal = new client.Counter({
  name: "redis_commands_total",
  help: "Count of Redis commands executed grouped by operation.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

export const historyContextTokensTotal = new client.Counter({
  name: "history_context_tokens_total",
  help: "Total tokens considered by history selection grouped by source, model, and action.",
  labelNames: ["source", "model", "action"] as const,
  registers: [metricsRegistry],
});

export const historyContextTierDropsTotal = new client.Counter({
  name: "history_context_tier_drops_total",
  help: "Count of dropped messages grouped by source and tier.",
  labelNames: ["source", "tier"] as const,
  registers: [metricsRegistry],
});

export const historyContextSelectionDurationSeconds = new client.Histogram({
  name: "history_context_selection_duration_seconds",
  help: "Duration of token-aware history selection grouped by source.",
  labelNames: ["source"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

export const historySummarizationsTotal = new client.Counter({
  name: "history_summarizations_total",
  help: "Count of history summarization events grouped by source and reason.",
  labelNames: ["source", "reason"] as const,
  registers: [metricsRegistry],
});

// wired via lazy hooks

// Re-export shared metrics from @alfred/metrics for backward compatibility
export {
  codexSessionValidationTimeoutTotal,
  cognitiveEntropyEventsTotal,
  cognitiveFeedbackSubmissionsTotal,
  cognitivePhysiologyGauge,
  decompositionTruncatedTotal,
  entityLinkingDurationMs,
  entityLinkingFallbackTotal,
  linearRateLimitRetryAfterTotal,
  linearRateLimitTotal,
  linearRateLimitWaitSeconds,
  memoryMaintenanceDurationSeconds,
  memoryNodesCleanedTotal,
  memoryNodesDecayedTotal,
  memoryNodesPrunedTotal,
  redisConnectionErrorsTotal,
  redisConnectionStatus,
  redisReconnectionAttemptsTotal,
} from "@alfred/metrics/shared";
export {
  recordVoiceStt,
  recordVoiceTts,
  type VoiceMetricStatus,
  voiceProcessHealth,
  voiceQueueDepthCurrent,
  voiceQueueDrainDurationSeconds,
  voiceSessionJitterMillis,
  voiceSessionPacketLossTotal,
  voiceSessionRttMillis,
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
  voiceSttDurationSeconds,
  voiceSttTotal,
  voiceTranscodeDurationSeconds,
  voiceTtsDurationSeconds,
  voiceTtsTotal,
} from "@alfred/voice/metrics";

// memoryMaintenanceDurationSeconds, memoryNodesDecayedTotal, memoryNodesPrunedTotal,
// memoryNodesCleanedTotal are now in @alfred/metrics/shared and re-exported above

export const assistantGenerateDurationSeconds = new client.Histogram({
  name: "assistant_generate_duration_seconds",
  help: "Duration of assistant generation in seconds.",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const assistantGenerateRequestsTotal = new client.Counter({
  name: "assistant_generate_requests_total",
  help: "Total number of assistant generation requests.",
  registers: [metricsRegistry],
});

export const orchestratorGenerateDurationSeconds = new client.Histogram({
  name: "orchestrator_generate_duration_seconds",
  help: "Duration of orchestrator generation in seconds.",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const orchestratorGenerateRequestsTotal = new client.Counter({
  name: "orchestrator_generate_requests_total",
  help: "Total number of orchestrator generation requests.",
  registers: [metricsRegistry],
});

// Physiology Metrics are now in @alfred/metrics/shared and re-exported above

// Lazily wire external metric hooks (agent/policy) to avoid heavy imports in tests
if (process.env.DISABLE_METRICS_HOOKS !== "1") {
  (async () => {
    try {
      const agent = await import("@alfred/agent");
      agent.registerDroidExecCounter?.(droidExecRunsTotal);
      agent.registerDroidExecHistogram?.(droidExecDurationSeconds);
      agent.registerCodexExecCounter?.(codexExecRunsTotal);
      agent.registerCodexExecHistogram?.(codexExecDurationSeconds);
      agent.registerCodexErrorCounter?.(codexErrorsTotal as any);
      agent.registerCodexSessionValidationHistogram?.({
        startTimer: () => {
          const done = codexSessionValidationDurationSeconds.startTimer();
          return ({ outcome }: { outcome: string }) => done({ outcome });
        },
      } as any);
      agent.registerEvalRunsCounter?.(evalRunsTotal);
      agent.registerEvalDurationHistogram?.(evalDurationSeconds);
      agent.registerEvalScoreCounter?.(evalScoresTotal);
      agent.registerEvalFailureCounter?.(evalFailuresTotal);
      agent.registerLaminarDatapointCounter?.(laminarEvalDatapointsTotal);
      agent.registerLaminarErrorCounter?.(laminarEvalErrorsTotal);
      agent.registerCompressionCycleCounter?.(compressionCyclesTotal);
      agent.registerCompressionCycleHistogram?.({
        startTimer: () => compressionCycleDurationSeconds.startTimer(),
      } as any);
      agent.registerCompressionNodeCounter?.(compressionNodesUpdatedTotal);
      agent.registerAssistantToolCounter?.(assistantToolCallsTotal);
      agent.registerAssistantEscalationCounter?.(assistantEscalationsTotal);
      agent.registerPolicyCheckFailureCounter?.(policyCheckFailuresTotal);
      agent.registerMemoryUpdatesCounter?.(memoryUpdatesTotal);
      agent.registerMemoryForgetsCounter?.(memoryForgetsTotal);
    } catch (error) {
      logger.warn("metrics_agent_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    // Wire classification metrics to @alfred/knowledge
    try {
      const { registerClassificationMetrics } = await import(
        "@alfred/knowledge/lexicon/domains"
      );
      registerClassificationMetrics({
        recordSource: (
          domain: string,
          source: "learned" | "static" | "seed"
        ) => {
          classificationSourceTotal.inc({ domain, source });
        },
        recordCacheHit: (hit: boolean) => {
          domainCacheHitsTotal.inc({ result: hit ? "hit" : "miss" });
        },
        recordDuration: (method: "sync" | "async", durationMs: number) => {
          classificationDurationSeconds.observe({ method }, durationMs / 1000);
        },
      });
    } catch (error) {
      logger.warn("metrics_classification_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      const policy = await import("@alfred/policy");
      policy.registerCacheObs?.((result: string) => {
        try {
          pdpCacheHitsTotal.inc({ result });
        } catch (error) {
          logger.warn("metrics_cache_hit_failed", {
            result,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    } catch (error) {
      logger.warn("metrics_policy_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

export const metricsContentType = metricsRegistry.contentType;

export function getMetricsSnapshot() {
  return metricsRegistry.metrics();
}
