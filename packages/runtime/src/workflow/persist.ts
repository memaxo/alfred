import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { makeEventId } from "@alfred/agent/utils/event-id";
import { eventToUiMessages } from "@alfred/agent/utils/normalize";
import { redactEventData } from "@alfred/agent/utils/redaction";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
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
]);

function getEventType(event: WorkflowEvent): string {
  return VALID_EVENT_TYPES.has(event.type) ? event.type : "event";
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
    const redactedEvent: WorkflowEvent = {
      ...redactedRecord,
      type: coerceNonEmptyString(redactedRecord.type) ?? args.event.type,
    };

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
        eventType: args.event.type,
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
    switch (redactedEvent.type) {
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
