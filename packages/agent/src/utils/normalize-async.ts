/**
 * Async Normalization with GenUI Enrichment
 *
 * Async versions of normalization functions that automatically enrich
 * tool results with GenUI data-ui parts.
 */

import { randomUUID } from "node:crypto";
import type { SchemaContext } from "@alfred/type/genui";
import type { UIMessage } from "@alfred/type/stream";
import { enrich } from "./enrich";
import type { NormalizableGenerate, ToolResultShape } from "./normalize";

type MessagePart = UIMessage["parts"][number];

function createToolCallPart(call: {
  id?: string;
  toolCallId?: string;
  toolName?: string;
  name?: string;
  args?: unknown;
  input?: unknown;
}): MessagePart {
  return {
    type: "tool-call",
    toolName: inferToolName(call),
    toolCallId: inferToolCallId(call),
    input: getToolInput(call) ?? {},
  } as unknown as MessagePart;
}

function inferToolCallId(data: { toolCallId?: string; id?: string }): string {
  if (typeof data.toolCallId === "string" && data.toolCallId.length > 0) {
    return data.toolCallId;
  }
  if (typeof data.id === "string" && data.id.length > 0) {
    return data.id;
  }
  return randomUUID();
}

function inferToolName(data: { toolName?: string; name?: string }): string {
  if (typeof data.toolName === "string" && data.toolName.length > 0) {
    return data.toolName;
  }
  if (typeof data.name === "string" && data.name.length > 0) {
    return data.name;
  }
  return "tool";
}

function getToolInput(shape: { args?: unknown; input?: unknown }): unknown {
  if (shape.args !== undefined) {
    return shape.args;
  }
  if (shape.input !== undefined) {
    return shape.input;
  }
  return;
}

/**
 * Async version of normalizeToUiMessages that enriches tool results with GenUI.
 *
 * @param result - The generate result to normalize
 * @param ctx - Optional schema context for GenUI enrichment
 * @returns Array of UIMessages with enriched tool results
 */
export async function normalizeToUiMessagesAsync(
  result: NormalizableGenerate,
  ctx?: Partial<SchemaContext>
): Promise<UIMessage[]> {
  const parts: MessagePart[] = [];

  if (typeof result.text === "string" && result.text.length > 0) {
    parts.push({ type: "text", text: result.text });
  }

  const calls = Array.isArray(result.toolCalls) ? result.toolCalls : [];
  for (const call of calls) {
    parts.push(createToolCallPart(call));
  }

  const toolResults = Array.isArray(result.toolResults)
    ? result.toolResults
    : [];
  for (const item of toolResults) {
    // Enrich tool results with GenUI
    const enrichedParts = await enrich(item as ToolResultShape, ctx);
    parts.push(...enrichedParts);
  }

  const assistantMessage: UIMessage = {
    id: randomUUID(),
    role: "assistant",
    parts,
  };

  return [assistantMessage];
}
