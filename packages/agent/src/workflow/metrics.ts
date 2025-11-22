import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

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

export const multiAgentTasksTotal = new client.Counter({
  name: "multi_agent_tasks_total",
  help: "Count of multi-agent subtasks grouped by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const multiAgentWavesTotal = new client.Counter({
  name: "multi_agent_waves_total",
  help: "Count of multi-agent waves grouped by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const multiAgentAgentDurationSeconds = new client.Histogram({
  name: "multi_agent_agent_duration_seconds",
  help: "Duration of agent runs grouped by role/outcome",
  labelNames: ["role", "outcome"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

export const multiAgentErrorsTotal = new client.Counter({
  name: "multi_agent_errors_total",
  help: "Count of multi-agent errors grouped by kind",
  labelNames: ["kind"] as const,
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

export const workflowProvenanceDurationSeconds = new client.Histogram({
  name: "workflow_provenance_duration_seconds",
  help: "Duration of workflow provenance persistence grouped by outcome.",
  labelNames: ["outcome"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const workflowProvenanceEdgesTotal = new client.Counter({
  name: "workflow_provenance_edges_total",
  help: "Count of explains edges created during workflow provenance linking.",
  labelNames: ["outcome"] as const,
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
