import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowEvent } from "@alfred/type";

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

export async function loadHistory(runId: string): Promise<WorkflowEvent[]> {
  const events = await workflowRepo.listEvents(runId);
  return events
    .reverse()
    .filter((e) => e.eventType !== "ui-message")
    .map((e) => {
      const unwrapped = unwrapEventEnvelope(e.eventData);
      const payload = coerceRecord(unwrapped.data);
      const hydrated: WorkflowEvent = {
        ...payload,
        type: e.eventType,
      };
      return hydrated;
    });
}
