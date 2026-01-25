import type { WorkflowEventType } from "@alfred/db/schema/workflow";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";

import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { makeEventId } from "@alfred/type/id";

import { wrapEventEnvelope } from "../utils/envelope";
import { eventToUiMessages } from "../utils/normalize";
import { redactEventData } from "../utils/redaction";

const VALID_EVENT_TYPES = [
  "run",
  "progress",
  "stdout",
  "stderr",
  "droid",
  "notice",
  "error",
  "ui-message",
  "text-delta",
  "tool-call",
  "tool-result",
  "reasoning",
  "finish",
  "data-status",
  "file",
  "obligation",
  "data-cache-handoff",
  "context",
  "plan-selected",
  "phase-start",
  "phase-complete",
  "phase-progress",
  "agent-start",
  "agent-complete",
  "wave-start",
  "wave-complete",
  "agent-handoff",
  "assistant",
  "report",
  "require-scope",
  "step-start",
  "step-complete",
  "step-skip",
  "step_start",
  "step_complete",
  "suspend",
  "resume",
] as const;

function getEventType(event: WorkflowEvent): WorkflowEventType {
  const type = event._;
  return (VALID_EVENT_TYPES as readonly string[]).includes(type)
    ? (type as WorkflowEventType)
    : "error"; // Default to error if unknown
}

function maybeUiMessages(event: WorkflowEvent): UIMessage[] | null {
  const msgs = eventToUiMessages(event);
  return Array.isArray(msgs) && msgs.length > 0 ? msgs : null;
}

export interface PersistEventResult {
  eventId: string;
  eventType: string;
  uiMessages: UIMessage[] | null;
}

export async function persistWorkflowEvent(
  runId: string,
  event: WorkflowEvent
): Promise<PersistEventResult> {
  const redactedEventData = redactEventData(event);
  const eventType = getEventType(event);
  const eventId = makeEventId({
    runId,
    type: eventType,
    data: redactedEventData,
  });

  await workflowRepo.appendEvent({
    runId,
    eventId,
    eventType,
    eventData: wrapEventEnvelope({
      id: eventId,
      type: eventType,
      resource: "user",
      data: redactedEventData,
    }),
  });

  const uiMessages = maybeUiMessages(event);

  if (uiMessages && uiMessages.length > 0) {
    const uiEventId = makeEventId({
      runId,
      type: "ui-message",
      data: uiMessages,
    });
    await workflowRepo.appendEvent({
      runId,
      eventId: uiEventId,
      eventType: "ui-message",
      eventData: wrapEventEnvelope({
        id: uiEventId,
        type: "ui-message",
        resource: "user",
        data: uiMessages,
      }),
    });
  }

  return { eventId, eventType, uiMessages };
}

export async function persistEventSafe(
  runId: string,
  event: WorkflowEvent
): Promise<PersistEventResult | null> {
  try {
    return await persistWorkflowEvent(runId, event);
  } catch (error) {
    logger.warn("workflow_event_persistence_failed", {
      runId,
      eventType: getEventType(event),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
