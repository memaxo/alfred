/**
 * @alfred/runtime
 *
 * Workflow execution runtime for ALFRED.
 * Pure execution engine with AsyncGenerator interface.
 */

export { createRuntime, WorkflowRuntime } from "./core";
export type {
  CognitiveEffect,
  CognitiveLoopResult,
} from "./loops/cognitive";
export {
  computeEffects,
  runAssistantGeneration,
  runCognitiveLoop,
} from "./loops/cognitive";
export { resumeInterruptedPlans } from "./loops/resume";
// Export metrics for observability
export {
  runtimeAiEventsTotal,
  runtimeAiSdkCallsTotal,
  runtimeAiSdkDurationSeconds,
  runtimeContextBuildDurationSeconds,
  runtimeContextCacheHitsTotal,
  runtimeContextTokensTotal,
  runtimeExecutionDurationSeconds,
  runtimeExecutionsTotal,
  runtimeKnowledgeBatchDurationSeconds,
  runtimeKnowledgeUpdatesTotal,
  runtimePhaseDurationSeconds,
  runtimePhasesTotal,
  runtimeToolGraphNodeDurationSeconds,
  runtimeToolGraphNodesTotal,
} from "./metrics";
export { convertPlanToWavePlan } from "./orchestrator/convert.js";
export * from "./orchestrator/index.js";
export type { TraceSpan } from "./tracing";
// Export tracing support
export { RuntimeTracer } from "./tracing";
export type {
  PhaseConfig,
  ResumePayload,
  RuntimeInput,
  RuntimeOptions,
  RuntimeState,
  WorkflowPhase,
  WorkflowRuntime as IWorkflowRuntime,
} from "./types";
