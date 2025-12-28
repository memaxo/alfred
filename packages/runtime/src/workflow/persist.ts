import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { eventToUiMessages } from "@alfred/agent/utils/normalize";
import { redactEventData } from "@alfred/agent/utils/redaction";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowEventType } from "@alfred/db/schema/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { makeEventId } from "@alfred/type/id";
import type { UIMessage } from "@alfred/type/stream";
import { persistWorkflowMessages } from "./executor";
import { emitLinearErrorActivity } from "./linear";

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function coerceNonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

const VALID_EVENT_TYPES = new Set([
  "run",
  "progress",
  "context",
  "require-scope",
  "notice",
  "error",
  "stdout",
  "stderr",
  "droid",
  "data-cache-handoff",
  "ui-message",
  "text-delta",
  "tool-call",
  "tool-result",
  "reasoning",
  "finish",
  "data-status",
  "file",
  "obligation",
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
  "step-start",
  "step-complete",
  "step-skip",
  "step_start",
  "step_complete",
  "suspend",
  "resume",
]);

function getEventType(event: WorkflowEvent): WorkflowEventType {
  const eventType =
    "_" in event && typeof event._ === "string" ? event._ : "event";
  return VALID_EVENT_TYPES.has(eventType)
    ? (eventType as WorkflowEventType)
    : "error";
}

function maybeUiMessages(event: WorkflowEvent): UIMessage[] | null {
  const msgs = eventToUiMessages(event);
  return Array.isArray(msgs) && msgs.length > 0 ? msgs : null;
}

export async function persistStreamEvent(args: {
  event: WorkflowEvent;
  runId: string;
  userId: string;
  workflowConversationId: string | null;
  persistedMessageKeys: Set<string>;
  emitUiMessages?: (
    messages: UIMessage[],
    meta: {
      runId: string;
      eventId: string;
      eventType: string;
      originalEvent: WorkflowEvent;
    }
  ) => void;
  triggerPreferenceRefresh: (
    userId: string,
    payload: { reason: string }
  ) => void;
  linear: WorkflowInputPayload["linear"] | undefined;
  authzLinear: string | undefined;
}): Promise<{ eventId: string; suspended: boolean } | null> {
  try {
    const redactedEventData = redactEventData(args.event);
    const eventType = getEventType(args.event);
    const eventId = makeEventId({
      runId: args.runId,
      type: eventType,
      data: redactedEventData,
    });

    await workflowRepo.appendEvent({
      runId: args.runId,
      eventId,
      eventType,
      eventData: wrapEventEnvelope({
        id: eventId,
        type: eventType,
        resource: "user",
        data: redactedEventData,
      }),
    });

    const redactedRecord = coerceRecord(redactedEventData);
    const eventDiscriminant =
      "_" in args.event && typeof args.event._ === "string"
        ? args.event._
        : "event";
    const redactedEvent: WorkflowEvent = {
      ...redactedRecord,
      _: coerceNonEmptyString(redactedRecord._) ?? eventDiscriminant,
    } as WorkflowEvent;

    const uiMessages = maybeUiMessages(redactedEvent);
    if (uiMessages && uiMessages.length > 0) {
      const uiEventId = makeEventId({
        runId: args.runId,
        type: "ui-message",
        data: uiMessages,
      });
      await workflowRepo.appendEvent({
        runId: args.runId,
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

    if (args.workflowConversationId && uiMessages && uiMessages.length > 0) {
      const persisted = await persistWorkflowMessages({
        userId: args.userId,
        conversationId: args.workflowConversationId,
        messages: uiMessages,
        persistedKeys: args.persistedMessageKeys,
        runId: args.runId,
        baseId: eventId,
        eventType: getEventType(args.event),
        eventId,
      });
      if (persisted > 0) {
        args.triggerPreferenceRefresh(args.userId, {
          reason: "workflow_messages_persisted",
        });
      }
    }

    if (uiMessages && uiMessages.length > 0) {
      args.emitUiMessages?.(uiMessages, {
        runId: args.runId,
        eventId,
        eventType,
        originalEvent: args.event,
      });
    }

    let suspended = false;
    const redactedEventType =
      "_" in redactedEvent && typeof redactedEvent._ === "string"
        ? redactedEvent._
        : "event";
    switch (redactedEventType) {
      case "notice": {
        suspended =
          coerceNonEmptyString(coerceRecord(redactedEvent).message) ===
          "workflow_suspended";
        break;
      }
      case "error": {
        if (args.linear?.sessionId && args.authzLinear) {
          const message =
            coerceNonEmptyString(coerceRecord(redactedEvent).message) ??
            "Workflow error occurred";
          emitLinearErrorActivity({
            runId: args.runId,
            message,
            linear: args.linear,
            authz: args.authzLinear,
          });
        }
        break;
      }
      default: {
        break;
      }
    }

    return { eventId, suspended };
  } catch (error) {
    logger.warn("workflow_event_persistence_failed", {
      runId: args.runId,
      eventType: getEventType(args.event),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
