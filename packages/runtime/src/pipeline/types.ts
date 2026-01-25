import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";

export type PhaseStatus = "success" | "failure" | "escalate";

export type PhaseResult<T> =
  | { status: "success"; data: T }
  | { status: "failure"; error: Error }
  | { status: "escalate"; reason: string; targetPhase?: string };

export interface Phase<Input, Output> {
  /**
   * Unique identifier for the phase (e.g., "plan", "act", "review")
   */
  id: string;

  /**
   * Execute the phase logic
   */
  run(
    input: Input,
    context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<Output>, void>;
}

export interface PipelineState {
  currentPhaseId: string;
  history: {
    phaseId: string;
    result: PhaseStatus;
    timestamp: number;
  }[];
  context: RuntimeContext;
}
