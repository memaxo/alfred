import { randomUUID } from "node:crypto";
import type { UIMessage } from "@alfred/type/stream";
import type { WorkflowEvent } from "@alfred/type";

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

/**
 * Convert a streamed WorkflowEvent into UIMessage(s) when possible.
 * Recognizes 'ui-message' passthrough, 'assistant', 'tool-call', and 'tool-result' shapes.
 */
export function eventToUiMessages(event: WorkflowEvent): UIMessage[] | null {
  // Passthrough of pre-normalized messages
  if ((event as any)?.type === "ui-message" && Array.isArray((event as any)?.messages)) {
    return (event as any).messages as UIMessage[];
  }

  const parts: UIMessage["parts"] = [] as any;

  // Assistant text/parts
  if ((event as any)?.type === "assistant") {
    const e = event as any;
    if (typeof e.text === "string" && e.text.length > 0) {
      parts.push({ type: "text", text: e.text });
    }
    if (Array.isArray(e.parts)) {
      // Trust already well-formed UI parts
      for (const p of e.parts) {
        if (p && typeof p === "object" && typeof (p as any).type === "string") {
          parts.push(p);
        }
      }
    }
    // Tool calls/results attached to assistant event
    if (Array.isArray(e.toolCalls)) {
      for (const c of e.toolCalls) {
        const toolName = c?.toolName || c?.name || "tool";
        const toolCallId = c?.id;
        parts.push({ type: "tool-call", toolName, toolCallId, input: c?.args ?? {} } as any);
      }
    }
    if (Array.isArray(e.toolResults)) {
      for (const r of e.toolResults) {
        const toolName = r?.toolName || "tool";
        const toolCallId = r?.id;
        const output = Object.prototype.hasOwnProperty.call(r ?? {}, "result") ? r?.result : r?.output;
        parts.push({ type: "tool-result", toolName, toolCallId, output } as any);
      }
    }
    if (parts.length > 0) {
      return [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts,
        } as UIMessage,
      ];
    }
  }

  // Standalone tool-call
  if ((event as any)?.type === "tool-call") {
    const e = event as any;
    const toolName = e?.toolName || e?.name || "tool";
    const toolCallId = e?.toolCallId || e?.id;
    const input = e?.input ?? e?.args ?? {};
    return [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "tool-call", toolName, toolCallId, input } as any],
      } as UIMessage,
    ];
  }

  // Standalone tool-result
  if ((event as any)?.type === "tool-result") {
    const e = event as any;
    const toolName = e?.toolName || "tool";
    const toolCallId = e?.toolCallId || e?.id;
    const output = Object.prototype.hasOwnProperty.call(e ?? {}, "result") ? e?.result : e?.output;
    return [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "tool-result", toolName, toolCallId, output } as any],
      } as UIMessage,
    ];
  }

  return null;
}
