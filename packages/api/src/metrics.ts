import client from "prom-client";
import {
  registerDroidExecCounter,
  registerDroidExecHistogram,
  registerCodexExecCounter,
  registerCodexExecHistogram,
  registerCodexErrorCounter,
  registerEvalRunsCounter,
  registerEvalDurationHistogram,
  registerEvalScoreCounter,
  registerEvalFailureCounter,
  registerLaminarDatapointCounter,
  registerLaminarErrorCounter,
  registerAssistantToolCounter,
  registerAssistantEscalationCounter,
  registerMemoryUpdatesCounter,
  registerMemoryForgetsCounter,
} from "@alfred/agent";
import { registerPolicyCacheObserver } from "@alfred/policy";

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({ register: metricsRegistry });

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

registerDroidExecCounter(droidExecRunsTotal);

export const droidExecDurationSeconds = new client.Histogram({
  name: "droid_exec_duration_seconds",
  help: "Duration of droid exec runs in seconds.",
  labelNames: ["auto"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

registerDroidExecHistogram(droidExecDurationSeconds);

export const codexExecRunsTotal = new client.Counter({
  name: "codex_exec_runs_total",
  help: "Count of Codex exec runs grouped by autonomy level and exit code.",
  labelNames: ["auto", "exit_code"] as const,
  registers: [metricsRegistry],
});

registerCodexExecCounter(codexExecRunsTotal);

export const codexExecDurationSeconds = new client.Histogram({
  name: "codex_exec_duration_seconds",
  help: "Duration of Codex exec runs in seconds.",
  labelNames: ["auto"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

registerCodexExecHistogram(codexExecDurationSeconds);

export const codexErrorsTotal = new client.Counter({
  name: "codex_errors_total",
  help: "Count of Codex executor errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

registerCodexErrorCounter(codexErrorsTotal);

export const evalRunsTotal = new client.Counter({
  name: "eval_runs_total",
  help: "Count of evaluation runs grouped by agent and status.",
  labelNames: ["agent", "status"] as const,
  registers: [metricsRegistry],
});

registerEvalRunsCounter(evalRunsTotal);

export const evalDurationSeconds = new client.Histogram({
  name: "eval_duration_seconds",
  help: "Duration of evaluation runs in seconds.",
  labelNames: ["agent"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 900, 1800],
  registers: [metricsRegistry],
});

registerEvalDurationHistogram(evalDurationSeconds);

export const evalScoresTotal = new client.Counter({
  name: "eval_scores_total",
  help: "Count of evaluation scores persisted per scorer.",
  labelNames: ["scorer"] as const,
  registers: [metricsRegistry],
});

registerEvalScoreCounter(evalScoresTotal);

export const evalFailuresTotal = new client.Counter({
  name: "eval_failures_total",
  help: "Count of evaluation scoring failures grouped by scorer and reason.",
  labelNames: ["scorer", "reason"] as const,
  registers: [metricsRegistry],
});

registerEvalFailureCounter(evalFailuresTotal);

export const laminarEvalDatapointsTotal = new client.Counter({
  name: "laminar_eval_datapoints_total",
  help: "Count of Laminar datapoint operations by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

registerLaminarDatapointCounter(laminarEvalDatapointsTotal);

export const laminarEvalErrorsTotal = new client.Counter({
  name: "laminar_eval_errors_total",
  help: "Count of Laminar export errors grouped by stage.",
  labelNames: ["stage"] as const,
  registers: [metricsRegistry],
});

registerLaminarErrorCounter(laminarEvalErrorsTotal);

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

export const assistantToolCallsTotal = new client.Counter({
  name: "assistant_tool_calls_total",
  help: "Count of assistant tool invocations grouped by tool name.",
  labelNames: ["tool"] as const,
  registers: [metricsRegistry],
});

registerAssistantToolCounter(assistantToolCallsTotal);

export const assistantEscalationsTotal = new client.Counter({
  name: "assistant_escalations_total",
  help: "Count of assistant escalations grouped by kind.",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
});

registerAssistantEscalationCounter(assistantEscalationsTotal);

export const memoryUpdatesTotal = new client.Counter({
  name: "memory_updates_total",
  help: "Count of memory updates grouped by kind and source.",
  labelNames: ["kind", "source"] as const,
  registers: [metricsRegistry],
});

registerMemoryUpdatesCounter(memoryUpdatesTotal);

export const memoryForgetsTotal = new client.Counter({
  name: "memory_forgets_total",
  help: "Count of memory forget operations grouped by scope.",
  labelNames: ["scope"] as const,
  registers: [metricsRegistry],
});

registerMemoryForgetsCounter(memoryForgetsTotal);

registerPolicyCacheObserver(result => {
  try {
    pdpCacheHitsTotal.inc({ result });
  } catch {
    // ignore metrics increment errors to avoid impacting policy evaluation
  }
});

export const metricsContentType = metricsRegistry.contentType;

export async function getMetricsSnapshot() {
  return metricsRegistry.metrics();
}
