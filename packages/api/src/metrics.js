import { registerAssistantEscalationCounter, registerAssistantToolCounter, registerCodexErrorCounter, registerCodexExecCounter, registerCodexExecHistogram, registerDroidExecCounter, registerDroidExecHistogram, registerEvalDurationHistogram, registerEvalFailureCounter, registerEvalRunsCounter, registerEvalScoreCounter, registerLaminarDatapointCounter, registerLaminarErrorCounter, registerMemoryForgetsCounter, registerMemoryUpdatesCounter, } from "@alfred/agent";
import { registerCacheObs } from "@alfred/policy";
import client from "prom-client";
import { logger } from "./utils/logger";
export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });
export const trpcRequestsTotal = new client.Counter({
    name: "trpc_requests_total",
    help: "Count of tRPC requests by procedure and type.",
    labelNames: ["procedure", "type"],
    registers: [metricsRegistry],
});
export const trpcRequestErrorsTotal = new client.Counter({
    name: "trpc_request_errors_total",
    help: "Count of failed tRPC requests by procedure, type, and code.",
    labelNames: ["procedure", "type", "code"],
    registers: [metricsRegistry],
});
export const trpcRequestDurationSeconds = new client.Histogram({
    name: "trpc_request_duration_seconds",
    help: "Duration of tRPC requests in seconds.",
    labelNames: ["procedure", "type"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});
export const healthChecksTotal = new client.Counter({
    name: "health_checks_total",
    help: "Count of health check invocations by target and status.",
    labelNames: ["target", "status"],
    registers: [metricsRegistry],
});
export const policyDecisionsTotal = new client.Counter({
    name: "policy_decisions_total",
    help: "Count of policy decisions grouped by action and decision.",
    labelNames: ["action", "decision"],
    registers: [metricsRegistry],
});
export const policyObligationsTotal = new client.Counter({
    name: "policy_obligations_total",
    help: "Count of policy obligations emitted by action.",
    labelNames: ["action", "obligation"],
    registers: [metricsRegistry],
});
export const runRegistryEventsTotal = new client.Counter({
    name: "run_registry_events_total",
    help: "Count of run registry events grouped by event, backend, and outcome.",
    labelNames: ["event", "backend", "outcome"],
    registers: [metricsRegistry],
});
export const runRegistryDispatchDurationSeconds = new client.Histogram({
    name: "run_registry_dispatch_duration_seconds",
    help: "Duration of run registry dispatch operations grouped by backend and outcome.",
    labelNames: ["backend", "outcome"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [metricsRegistry],
});
export const pdpCacheHitsTotal = new client.Counter({
    name: "pdp_cache_hits_total",
    help: "Count of policy cache hits and misses.",
    labelNames: ["result"],
    registers: [metricsRegistry],
});
export const droidExecRunsTotal = new client.Counter({
    name: "droid_exec_runs_total",
    help: "Count of droid exec runs grouped by autonomy level and exit code.",
    labelNames: ["auto", "exit_code"],
    registers: [metricsRegistry],
});
registerDroidExecCounter(droidExecRunsTotal);
export const droidExecDurationSeconds = new client.Histogram({
    name: "droid_exec_duration_seconds",
    help: "Duration of droid exec runs in seconds.",
    labelNames: ["auto"],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
    registers: [metricsRegistry],
});
registerDroidExecHistogram(droidExecDurationSeconds);
export const codexExecRunsTotal = new client.Counter({
    name: "codex_exec_runs_total",
    help: "Count of Codex exec runs grouped by autonomy level and exit code.",
    labelNames: ["auto", "exit_code"],
    registers: [metricsRegistry],
});
registerCodexExecCounter(codexExecRunsTotal);
export const codexExecDurationSeconds = new client.Histogram({
    name: "codex_exec_duration_seconds",
    help: "Duration of Codex exec runs in seconds.",
    labelNames: ["auto"],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
    registers: [metricsRegistry],
});
registerCodexExecHistogram(codexExecDurationSeconds);
export const codexErrorsTotal = new client.Counter({
    name: "codex_errors_total",
    help: "Count of Codex executor errors grouped by stage.",
    labelNames: ["stage"],
    registers: [metricsRegistry],
});
registerCodexErrorCounter(codexErrorsTotal);
export const evalRunsTotal = new client.Counter({
    name: "eval_runs_total",
    help: "Count of evaluation runs grouped by agent and status.",
    labelNames: ["agent", "status"],
    registers: [metricsRegistry],
});
registerEvalRunsCounter(evalRunsTotal);
export const evalDurationSeconds = new client.Histogram({
    name: "eval_duration_seconds",
    help: "Duration of evaluation runs in seconds.",
    labelNames: ["agent"],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 900, 1800],
    registers: [metricsRegistry],
});
registerEvalDurationHistogram(evalDurationSeconds);
export const evalScoresTotal = new client.Counter({
    name: "eval_scores_total",
    help: "Count of evaluation scores persisted per scorer.",
    labelNames: ["scorer"],
    registers: [metricsRegistry],
});
registerEvalScoreCounter(evalScoresTotal);
export const evalFailuresTotal = new client.Counter({
    name: "eval_failures_total",
    help: "Count of evaluation scoring failures grouped by scorer and reason.",
    labelNames: ["scorer", "reason"],
    registers: [metricsRegistry],
});
registerEvalFailureCounter(evalFailuresTotal);
export const laminarEvalDatapointsTotal = new client.Counter({
    name: "laminar_eval_datapoints_total",
    help: "Count of Laminar datapoint operations by status.",
    labelNames: ["status"],
    registers: [metricsRegistry],
});
registerLaminarDatapointCounter(laminarEvalDatapointsTotal);
export const laminarEvalErrorsTotal = new client.Counter({
    name: "laminar_eval_errors_total",
    help: "Count of Laminar export errors grouped by stage.",
    labelNames: ["stage"],
    registers: [metricsRegistry],
});
registerLaminarErrorCounter(laminarEvalErrorsTotal);
export const webhookEventsTotal = new client.Counter({
    name: "webhook_events_total",
    help: "Count of webhook events grouped by type.",
    labelNames: ["type"],
    registers: [metricsRegistry],
});
export const webhookErrorsTotal = new client.Counter({
    name: "webhook_errors_total",
    help: "Count of webhook handler errors grouped by stage.",
    labelNames: ["stage"],
    registers: [metricsRegistry],
});
export const rateLimitHitsTotal = new client.Counter({
    name: "rate_limit_hits_total",
    help: "Count of rate limit hits grouped by procedure.",
    labelNames: ["procedure"],
    registers: [metricsRegistry],
});
export const assistantToolCallsTotal = new client.Counter({
    name: "assistant_tool_calls_total",
    help: "Count of assistant tool invocations grouped by tool name.",
    labelNames: ["tool"],
    registers: [metricsRegistry],
});
registerAssistantToolCounter(assistantToolCallsTotal);
export const assistantEscalationsTotal = new client.Counter({
    name: "assistant_escalations_total",
    help: "Count of assistant escalations grouped by kind.",
    labelNames: ["kind"],
    registers: [metricsRegistry],
});
registerAssistantEscalationCounter(assistantEscalationsTotal);
export const memoryUpdatesTotal = new client.Counter({
    name: "memory_updates_total",
    help: "Count of memory updates grouped by kind and source.",
    labelNames: ["kind", "source"],
    registers: [metricsRegistry],
});
registerMemoryUpdatesCounter(memoryUpdatesTotal);
export const memoryForgetsTotal = new client.Counter({
    name: "memory_forgets_total",
    help: "Count of memory forget operations grouped by scope.",
    labelNames: ["scope"],
    registers: [metricsRegistry],
});
registerMemoryForgetsCounter(memoryForgetsTotal);
export const voiceSttTotal = new client.Counter({
    name: "voice_stt_total",
    help: "Count of voice STT invocations grouped by provider and status.",
    labelNames: ["provider", "status"],
    registers: [metricsRegistry],
});
export const voiceSttDurationSeconds = new client.Histogram({
    name: "voice_stt_duration_seconds",
    help: "Duration of voice STT inference in seconds grouped by provider.",
    labelNames: ["provider"],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry],
});
export const voiceTtsTotal = new client.Counter({
    name: "voice_tts_total",
    help: "Count of voice TTS invocations grouped by provider and status.",
    labelNames: ["provider", "status"],
    registers: [metricsRegistry],
});
export const voiceTtsDurationSeconds = new client.Histogram({
    name: "voice_tts_duration_seconds",
    help: "Duration of voice TTS synthesis in seconds grouped by provider.",
    labelNames: ["provider"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});
const coerceProvider = (provider) => provider && provider.length > 0 ? provider : "unknown";
const observeDuration = (histogram, provider, durationSeconds) => {
    if (typeof durationSeconds !== "number")
        return;
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0)
        return;
    histogram.observe({ provider }, durationSeconds);
};
export function recordVoiceStt({ provider, status, durationSeconds, }) {
    const normalizedProvider = coerceProvider(provider);
    voiceSttTotal.inc({ provider: normalizedProvider, status });
    observeDuration(voiceSttDurationSeconds, normalizedProvider, durationSeconds);
}
export function recordVoiceTts({ provider, status, durationSeconds, }) {
    const normalizedProvider = coerceProvider(provider);
    voiceTtsTotal.inc({ provider: normalizedProvider, status });
    observeDuration(voiceTtsDurationSeconds, normalizedProvider, durationSeconds);
}
export const assistantStreamEventsTotal = new client.Counter({
    name: "assistant_stream_events_total",
    help: "Count of assistant stream events grouped by event type.",
    labelNames: ["event"],
    registers: [metricsRegistry],
});
export const assistantStreamDurationSeconds = new client.Histogram({
    name: "assistant_stream_duration_seconds",
    help: "Duration of assistant streams in seconds grouped by terminal status.",
    labelNames: ["status"],
    buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [metricsRegistry],
});
function normalizeEventLabel(event) {
    if (!event) {
        return "unknown";
    }
    return event.trim().toLowerCase() || "unknown";
}
export function recordStreamEvent(event) {
    try {
        assistantStreamEventsTotal.inc({ event: normalizeEventLabel(event) });
    }
    catch (error) {
        // Metrics failures should not break critical paths (streaming)
        // Logged at warn level to maintain observability without impacting performance
        logger.warn("metrics_stream_event_failed", {
            event,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
export function startStreamTimer() {
    try {
        const stopTimer = assistantStreamDurationSeconds.startTimer();
        return (status) => {
            try {
                stopTimer({ status });
            }
            catch (error) {
                // Metrics failures should not break critical paths (streaming)
                // Logged at warn level to maintain observability without impacting performance
                logger.warn("metrics_timer_stop_failed", {
                    status,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        };
    }
    catch (error) {
        // Metrics failures should not break critical paths (streaming)
        // Logged at warn level to maintain observability without impacting performance
        logger.warn("metrics_timer_create_failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        return;
    }
}
export const workflowStreamEventsTotal = new client.Counter({
    name: "workflow_stream_events_total",
    help: "Count of workflow stream events grouped by event type.",
    labelNames: ["event"],
    registers: [metricsRegistry],
});
export const workflowStreamDurationSeconds = new client.Histogram({
    name: "workflow_stream_duration_seconds",
    help: "Duration of workflow streams in seconds grouped by terminal status.",
    labelNames: ["status"],
    buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [metricsRegistry],
});
export const runnerStepsTotal = new client.Counter({
    name: "workflow_runner_steps_total",
    help: "Count of workflow runner steps grouped by phase and outcome.",
    labelNames: ["phase", "outcome"],
    registers: [metricsRegistry],
});
export const runnerErrorsTotal = new client.Counter({
    name: "workflow_runner_errors_total",
    help: "Count of workflow runner errors grouped by phase and reason.",
    labelNames: ["phase", "reason"],
    registers: [metricsRegistry],
});
export const replayQueriesTotal = new client.Counter({
    name: "workflow_replay_queries_total",
    help: "Count of workflow replay queries grouped by event type.",
    labelNames: ["event_type"],
    registers: [metricsRegistry],
});
export const replayQueryDurationSeconds = new client.Histogram({
    name: "workflow_replay_query_duration_seconds",
    help: "Duration of workflow replay queries in seconds grouped by event type.",
    labelNames: ["event_type"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [metricsRegistry],
});
export const linearActivityEmissionsTotal = new client.Counter({
    name: "linear_activity_emissions_total",
    help: "Total Linear activity emissions",
    labelNames: ["type", "status"],
    registers: [metricsRegistry],
});
export const linearActivityDurationSeconds = new client.Histogram({
    name: "linear_activity_duration_seconds",
    help: "Linear activity emission duration",
    labelNames: ["type"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});
export const linearSessionOperationsTotal = new client.Counter({
    name: "linear_session_operations_total",
    help: "Linear session operations (delegate, state)",
    labelNames: ["operation", "status"],
    registers: [metricsRegistry],
});
export const linearWebhookEventsTotal = new client.Counter({
    name: "linear_webhook_events_total",
    help: "Total Linear webhook events received",
    labelNames: ["event_type", "action"],
    registers: [metricsRegistry],
});
export const linearWebhookWorkflowStartsTotal = new client.Counter({
    name: "linear_webhook_workflow_starts_total",
    help: "Total workflows started from Linear webhook events",
    registers: [metricsRegistry],
});
export const linearWebhookWorkflowCancelsTotal = new client.Counter({
    name: "linear_webhook_workflow_cancels_total",
    help: "Total workflows cancelled from Linear webhook events",
    registers: [metricsRegistry],
});
registerCacheObs((result) => {
    try {
        pdpCacheHitsTotal.inc({ result });
    }
    catch (error) {
        // Metrics failures should not break critical paths (policy evaluation)
        // Logged at warn level to maintain observability without impacting performance
        logger.warn("metrics_cache_hit_failed", {
            result,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
export const metricsContentType = metricsRegistry.contentType;
export async function getMetricsSnapshot() {
    return metricsRegistry.metrics();
}
//# sourceMappingURL=metrics.js.map