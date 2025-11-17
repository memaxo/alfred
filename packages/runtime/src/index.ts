/**
 * @alfred/runtime
 * 
 * Workflow execution runtime for ALFRED.
 * Pure execution engine with AsyncGenerator interface.
 */

export { createRuntime, WorkflowRuntime } from "./core";
export type {
  RuntimeInput,
  RuntimeOptions,
  RuntimeState,
  ResumePayload,
  WorkflowPhase,
  PhaseConfig,
  WorkflowRuntime as IWorkflowRuntime,
} from "./types";

// Export metrics for observability
export {
  runtimeExecutionsTotal,
  runtimeExecutionDurationSeconds,
  runtimePhasesTotal,
  runtimePhaseDurationSeconds,
  runtimeContextBuildDurationSeconds,
  runtimeContextCacheHitsTotal,
  runtimeContextTokensTotal,
  runtimeAiSdkCallsTotal,
  runtimeAiSdkDurationSeconds,
  runtimeAiEventsTotal,
  runtimeKnowledgeUpdatesTotal,
  runtimeKnowledgeBatchDurationSeconds,
} from "./metrics";

// Export tracing support
export { RuntimeTracer } from "./tracing";
export type { TraceSpan } from "./tracing";

