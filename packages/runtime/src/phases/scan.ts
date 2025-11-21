import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeInput } from "../types";

export async function* executeScanPhase(
  _input: RuntimeInput,
  _runId: string,
  signal: AbortSignal
): AsyncGenerator<WorkflowEvent, void, void> {
  yield {
    type: "context",
    phase: "scan",
    message: "gathering_context",
  } as WorkflowEvent;

  // Check for abort
  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  // TODO: Integrate with context builder (Phase 3.2)
  // For now, emit placeholder
  yield {
    type: "notice",
    message: "context_gathering_placeholder",
  } as WorkflowEvent;
}
