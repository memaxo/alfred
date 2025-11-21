// External metric hooks (agent/policy) are wired lazily below to keep tests light
import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";
import { logger } from "./utils/logger";

export { metricsRegistry };

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

export const runRegistryEventsTotal = new client.Counter({
  name: "run_registry_events_total",
  help: "Count of run registry events grouped by event, backend, and outcome.",
  labelNames: ["event", "backend", "outcome"] as const,
  registers: [metricsRegistry],
});

export const runRegistryDispatchDurationSeconds = new client.Histogram({
  name: "run_registry_dispatch_duration_seconds",
  help: "Duration of run registry dispatch operations grouped by backend and outcome.",
  labelNames: ["backend", "outcome"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
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

// wired via lazy hooks

export const voiceSttTotal = new client.Counter({
  name: "voice_stt_total",
  help: "Count of voice STT invocations grouped by provider and status.",
  labelNames: ["provider", "status"] as const,
  registers: [metricsRegistry],
});

export const assistantGenerateRequestsTotal = new client.Counter({
  name: "assistant_generate_requests_total",
  help: "Count of assistant generate requests grouped by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const assistantGenerateDurationSeconds = new client.Histogram({
  name: "assistant_generate_duration_seconds",
  help: "Duration of assistant generate requests grouped by status.",
  labelNames: ["status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const orchestratorGenerateRequestsTotal = new client.Counter({
  name: "orchestrator_generate_requests_total",
  help: "Count of orchestrator generate requests grouped by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const orchestratorGenerateDurationSeconds = new client.Histogram({
  name: "orchestrator_generate_duration_seconds",
  help: "Duration of orchestrator generate requests grouped by status.",
  labelNames: ["status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const voiceSttDurationSeconds = new client.Histogram({
  name: "voice_stt_duration_seconds",
  help: "Duration of voice STT inference in seconds grouped by provider.",
  labelNames: ["provider"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const voiceTtsTotal = new client.Counter({
  name: "voice_tts_total",
  help: "Count of voice TTS invocations grouped by provider and status.",
  labelNames: ["provider", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceTtsDurationSeconds = new client.Histogram({
  name: "voice_tts_duration_seconds",
  help: "Duration of voice TTS synthesis in seconds grouped by provider.",
  labelNames: ["provider"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export type VoiceMetricStatus = "ok" | "error" | "cancel";

// Voice streaming metrics (lightweight stubs to satisfy imports)
// Voice stream metrics are defined below alongside other stream metrics

const coerceProvider = (provider?: string) =>
  provider && provider.length > 0 ? provider : "unknown";

const observeDuration = (
  histogram: client.Histogram,
  provider: string,
  durationSeconds?: number
) => {
  if (typeof durationSeconds !== "number") return;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return;
  histogram.observe({ provider }, durationSeconds);
};

export function recordVoiceStt({
  provider,
  status,
  durationSeconds,
}: {
  provider?: string;
  status: VoiceMetricStatus;
  durationSeconds?: number;
}) {
  const normalizedProvider = coerceProvider(provider);
  voiceSttTotal.inc({ provider: normalizedProvider, status });
  observeDuration(voiceSttDurationSeconds, normalizedProvider, durationSeconds);
}

export function recordVoiceTts({
  provider,
  status,
  durationSeconds,
}: {
  provider?: string;
  status: VoiceMetricStatus;
  durationSeconds?: number;
}) {
  const normalizedProvider = coerceProvider(provider);
  voiceTtsTotal.inc({ provider: normalizedProvider, status });
  observeDuration(voiceTtsDurationSeconds, normalizedProvider, durationSeconds);
}

export const assistantStreamEventsTotal = new client.Counter({
  name: "assistant_stream_events_total",
  help: "Count of assistant stream events grouped by event type.",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});

export const assistantStreamDurationSeconds = new client.Histogram({
  name: "assistant_stream_duration_seconds",
  help: "Duration of assistant streams in seconds grouped by terminal status.",
  labelNames: ["status"] as const,
  buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

type AssistantStreamStatus = "ok" | "error" | "cancel";

function normalizeEventLabel(event: string): string {
  if (!event) {
    return "unknown";
  }
  return event.trim().toLowerCase() || "unknown";
}

export function recordStreamEvent(event: string): void {
  try {
    assistantStreamEventsTotal.inc({ event: normalizeEventLabel(event) });
  } catch (error) {
    // Metrics failures should not break critical paths (streaming)
    // Logged at warn level to maintain observability without impacting performance
    logger.warn("metrics_stream_event_failed", {
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startStreamTimer():
  | ((status: AssistantStreamStatus) => void)
  | undefined {
  try {
    const stopTimer = assistantStreamDurationSeconds.startTimer();
    return (status: AssistantStreamStatus) => {
      try {
        stopTimer({ status });
      } catch (error) {
        // Metrics failures should not break critical paths (streaming)
        // Logged at warn level to maintain observability without impacting performance
        logger.warn("metrics_timer_stop_failed", {
          status,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
  } catch (error) {
    // Metrics failures should not break critical paths (streaming)
    // Logged at warn level to maintain observability without impacting performance
    logger.warn("metrics_timer_create_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}

export const voiceStreamEventsTotal = new client.Counter({
  name: "voice_stream_events_total",
  help: "Count of voice stream events grouped by event type and status.",
  labelNames: ["event", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceStreamLatencySeconds = new client.Histogram({
  name: "voice_stream_latency_seconds",
  help: "Latency of voice stream operations in seconds grouped by stage.",
  labelNames: ["stage"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const voiceQueueDepthCurrent = new client.Gauge({
  name: "voice_queue_depth_current",
  help: "Current depth of voice queue.",
  registers: [metricsRegistry],
});

export const voiceQueueDrainDurationSeconds = new client.Histogram({
  name: "voice_queue_drain_duration_seconds",
  help: "Duration of voice queue drain operations in seconds.",
  registers: [metricsRegistry],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const voiceProcessHealth = new client.Gauge({
  name: "voice_process_health",
  help: "Health status of voice processes (1 = healthy, 0 = unhealthy) grouped by type.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const workflowStreamEventsTotal = new client.Counter({
  name: "workflow_stream_events_total",
  help: "Count of workflow stream events grouped by event type.",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});

export const workflowStreamDurationSeconds = new client.Histogram({
  name: "workflow_stream_duration_seconds",
  help: "Duration of workflow streams in seconds grouped by terminal status.",
  labelNames: ["status"] as const,
  buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

export const runnerStepsTotal = new client.Counter({
  name: "workflow_runner_steps_total",
  help: "Count of workflow runner steps grouped by phase and outcome.",
  labelNames: ["phase", "outcome"] as const,
  registers: [metricsRegistry],
});

export const runnerErrorsTotal = new client.Counter({
  name: "workflow_runner_errors_total",
  help: "Count of workflow runner errors grouped by phase and reason.",
  labelNames: ["phase", "reason"] as const,
  registers: [metricsRegistry],
});

export const replayQueriesTotal = new client.Counter({
  name: "workflow_replay_queries_total",
  help: "Count of workflow replay queries grouped by event type.",
  labelNames: ["event_type"] as const,
  registers: [metricsRegistry],
});

export const replayQueryDurationSeconds = new client.Histogram({
  name: "workflow_replay_query_duration_seconds",
  help: "Duration of workflow replay queries in seconds grouped by event type.",
  labelNames: ["event_type"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry],
});

export const linearActivityEmissionsTotal = new client.Counter({
  name: "linear_activity_emissions_total",
  help: "Total Linear agent activity emissions",
  labelNames: ["type", "status"] as const,
  registers: [metricsRegistry],
});

export const linearActivityDurationSeconds = new client.Histogram({
  name: "linear_activity_duration_seconds",
  help: "Duration of Linear activity emissions",
  labelNames: ["type"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

export const linearSessionOperationsTotal = new client.Counter({
  name: "linear_session_operations_total",
  help: "Total Linear session operations (delegate, state, URL)",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

export const linearWebhookEventsTotal = new client.Counter({
  name: "linear_webhook_events_total",
  help: "Total Linear webhook events received",
  labelNames: ["event_type", "action"] as const,
  registers: [metricsRegistry],
});

export const linearWebhookWorkflowStartsTotal = new client.Counter({
  name: "linear_webhook_workflow_starts_total",
  help: "Total workflows started from Linear webhooks",
  registers: [metricsRegistry],
});

export const linearWebhookWorkflowCancelsTotal = new client.Counter({
  name: "linear_webhook_workflow_cancels_total",
  help: "Total workflows canceled from Linear webhooks",
  registers: [metricsRegistry],
});

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
      agent.registerMemoryUpdatesCounter?.(memoryUpdatesTotal);
      agent.registerMemoryForgetsCounter?.(memoryForgetsTotal);
    } catch (error) {
      logger.warn("metrics_agent_hooks_disabled", {
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
