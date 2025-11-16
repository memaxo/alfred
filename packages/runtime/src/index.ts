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

