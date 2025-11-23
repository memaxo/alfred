import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex/index";
import type { UIMessage } from "@alfred/type/stream";

/**
 * Convert AlfredCodexEvent stream to AI SDK v6 UIMessage parts
 * for consumption by frontend chat components via toUIMessageStreamResponse
 */
export function codexEventToUiMessagePart(
  event: AlfredCodexEvent
): UIMessage["parts"][number] | null {
  switch (event.type) {
    case "thought":
      return {
        type: "reasoning",
        text: event.content,
        state: "streaming",
      };
    case "command":
      return {
        type: "text",
        text: `[Command: ${event.command}] Status: ${event.status}`,
      };
    case "output":
      return {
        type: "text",
        text: event.content,
      };
    case "artifact":
      return {
        type: "file",
        mediaType: event.kind === "image" ? "image/*" : "text/plain",
        url: `file://${event.path}`,
        filename: event.path,
      };
    default:
      return null;
  }
}

/**
 * Batch convert multiple Codex events into a single assistant message
 */
export function codexEventsToUiMessage(
  events: AlfredCodexEvent[],
  messageId?: string
): UIMessage | null {
  if (events.length === 0) {
    return null;
  }

  const parts: UIMessage["parts"] = [];
  for (const event of events) {
    const part = codexEventToUiMessagePart(event);
    if (part) {
      parts.push(part);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    id: messageId ?? `codex-${Date.now()}`,
    role: "assistant",
    parts,
  };
}
