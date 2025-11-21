import type { WorkflowEvent } from "@alfred/type/plan";

export async function* executeReportPhase(
  signal: AbortSignal
): AsyncGenerator<WorkflowEvent, void, void> {
  yield { type: "notice", message: "reporting_started" } as WorkflowEvent;

  // Check for abort
  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  // TODO: Generate report (Phase 3.2)
  // For now, emit placeholder
  yield {
    type: "notice",
    message: "reporting_placeholder",
  } as WorkflowEvent;
}
