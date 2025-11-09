import { randomUUID } from "node:crypto";
import type { UIMessage } from "@alfred/type/stream";

export type NormalizableGenerate = {
  text?: string | null;
  toolCalls?: Array<{
    id?: string;
    name?: string;
    toolName?: string;
    args?: unknown;
  }> | null;
  toolResults?: Array<{
    id?: string;
    toolName?: string;
    result?: unknown;
    output?: unknown;
  }> | null;
};

/**
 * Convert a non-stream generateText result into canonical AI SDK v6 UIMessage parts.
 * Produces a single assistant message with text/tool-call/tool-result parts.
 */
export function normalizeToUiMessages(result: NormalizableGenerate): UIMessage[] {
  const parts: UIMessage["parts"] = [] as any;

  if (typeof result.text === "string" && result.text.length > 0) {
    parts.push({ type: "text", text: result.text });
  }

  const calls = Array.isArray(result.toolCalls) ? result.toolCalls : [];
  for (const call of calls) {
    const toolName = call.toolName || call.name || "tool";
    const toolCallId = call.id || randomUUID();
    parts.push({
      type: "tool-call",
      toolName,
      toolCallId,
      input: call.args ?? {},
    } as any);
  }

  const results = Array.isArray(result.toolResults) ? result.toolResults : [];
  for (const item of results) {
    const toolCallId = item.id || randomUUID();
    const toolName = item.toolName || "tool";
    const payload = Object.prototype.hasOwnProperty.call(item, "result")
      ? (item as any).result
      : (item as any).output;
    parts.push({
      type: "tool-result",
      toolCallId,
      toolName,
      output: payload,
    } as any);
  }

  const assistantMessage: UIMessage = {
    id: randomUUID(),
    role: "assistant",
    parts,
  };

  return [assistantMessage];
}
