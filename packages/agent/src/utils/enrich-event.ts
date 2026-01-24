/**
 * Async Tool Result Enrichment for Events
 *
 * Enriches tool-result events with GenUI data-ui parts.
 * This is the async version for use in event stream processing.
 */

import type { WorkflowEvent } from "@alfred/type";
import type { SchemaContext } from "@alfred/type/genui";
import type { UIMessage } from "@alfred/type/stream";

import { randomUUID } from "node:crypto";

import { enrich } from "./enrich";
import { eventToUiMessages } from "./normalize";

type ToolResultEventPayload = WorkflowEvent & {
  _: "tool-result";
  toolCallId?: string;
  toolName?: string;
  result?: unknown;
  output?: unknown;
};

function isToolResultEvent(
  event: WorkflowEvent
): event is ToolResultEventPayload {
  return event._ === "tool-result";
}

/**
 * Enrich a tool-result event with GenUI and convert to UIMessages.
 *
 * @param event - The tool-result event
 * @param ctx - Optional schema context (userId, surface, mode, etc.)
 * @returns Array of UIMessages with enriched parts
 */
export async function enrichToolResultEvent(
  event: WorkflowEvent,
  ctx?: Partial<SchemaContext>
): Promise<UIMessage[] | null> {
  if (!isToolResultEvent(event)) {
    return eventToUiMessages(event);
  }

  const enrichedParts = await enrich(
    {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      result: event.result,
      output: event.output,
    },
    ctx
  );

  if (enrichedParts.length === 0) {
    return null;
  }

  const eventId =
    "id" in event && typeof event.id === "string" ? event.id : randomUUID();
  return [
    {
      id: eventId,
      role: "assistant" as const,
      parts: enrichedParts,
    },
  ];
}
