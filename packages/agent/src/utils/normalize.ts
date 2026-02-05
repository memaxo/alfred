import type { SearchReceipt, WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";

import { randomUUID } from "node:crypto";

import { coerceNonEmptyString } from "./coerce";

type MessagePart = UIMessage["parts"][number];

interface ToolCallShape {
  id?: string;
  toolCallId?: string;
  toolName?: string;
  name?: string;
  args?: unknown;
  input?: unknown;
}

export type ToolResultShape = ToolCallShape & {
  result?: unknown;
  output?: unknown;
};

type AssistantEventPayload = WorkflowEvent & {
  _: "context" | "assistant";
  text?: string;
  reasoning?: string;
  parts?: MessagePart[];
  toolCalls?: ToolCallShape[];
  toolResults?: ToolResultShape[];
};

type ToolCallEventPayload = WorkflowEvent & ToolCallShape & { _: "tool-call" };
type ToolResultEventPayload = WorkflowEvent &
  ToolResultShape & { _: "tool-result" };
type ReasoningEventPayload = WorkflowEvent & {
  _: "reasoning";
  text?: string;
  reasoning?: string;
};
type DataStatusEventPayload = WorkflowEvent & {
  _: "data-status";
  data?: unknown;
  transient?: boolean;
};
type FileEventPayload = WorkflowEvent & {
  _: "file";
  mediaType?: string;
  mimeType?: string;
  url?: string;
  data?: unknown;
  filename?: string;
  name?: string;
};
type DataCacheEventPayload = WorkflowEvent & {
  _: "data-cache-handoff";
  receipts?: SearchReceipt | SerializedReceipt;
};

type SerializedReceipt = Omit<SearchReceipt, "created"> & {
  created: string | Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessagePart(part: unknown): part is MessagePart {
  return (
    isPlainObject(part) && typeof (part as { type?: unknown }).type === "string"
  );
}

function isUiMessageEvent(
  event: WorkflowEvent
): event is WorkflowEvent & { _: "ui-message"; messages: UIMessage[] } {
  return event._ === "ui-message";
}

function isAssistantEvent(
  event: WorkflowEvent
): event is AssistantEventPayload {
  return event._ === "context" || event._ === "assistant";
}

function isToolCallEvent(event: WorkflowEvent): event is ToolCallEventPayload {
  return event._ === "tool-call";
}

function isToolResultEvent(
  event: WorkflowEvent
): event is ToolResultEventPayload {
  return event._ === "tool-result";
}

function isReasoningEvent(
  event: WorkflowEvent
): event is ReasoningEventPayload {
  return event._ === "reasoning";
}

function isDataStatusEvent(
  event: WorkflowEvent
): event is DataStatusEventPayload {
  return event._ === "data-status";
}

function isFileEvent(event: WorkflowEvent): event is FileEventPayload {
  return event._ === "file";
}

function isDataCacheEvent(
  event: WorkflowEvent
): event is DataCacheEventPayload {
  return event._ === "data-cache-handoff";
}

export interface NormalizableGenerate {
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
}

/**
 * Convert a non-stream generateText result into canonical AI SDK v6 UIMessage parts.
 * Produces a single assistant message with text/tool-call/tool-result parts.
 */
export function normalizeToUiMessages(
  result: NormalizableGenerate
): UIMessage[] {
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
    parts.push(createToolResultPart(item));
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
  if (isUiMessageEvent(event)) {
    return event.messages;
  }

  if (isAssistantEvent(event)) {
    return normalizeAssistantEvent(event);
  }

  if (event._ === "text-delta") {
    return [createAssistantMessage([{ type: "text", text: event.delta }])];
  }

  if (isToolCallEvent(event)) {
    return [createAssistantMessage([createToolCallPart(event)])];
  }

  if (isToolResultEvent(event)) {
    // Note: enrich() is async but eventToUiMessages is sync
    // Enrichment will be handled in async contexts (see enrichToolResultEvent)
    return [createAssistantMessage([createToolResultPart(event)])];
  }

  if (isReasoningEvent(event)) {
    return normalizeReasoningEvent(event);
  }

  if (event._ === "finish") {
    return null; // Finish events don't map to messages usually
  }

  if (isDataStatusEvent(event)) {
    return normalizeDataStatusEvent(event);
  }

  if (isDataCacheEvent(event)) {
    return normalizeDataCacheEvent(event);
  }

  if (isFileEvent(event)) {
    return normalizeFileEvent(event);
  }

  return null;
}

function normalizeAssistantEvent(
  event: AssistantEventPayload
): UIMessage[] | null {
  const parts = collectAssistantParts(event);
  if (parts.length === 0) {
    return null;
  }
  return [createAssistantMessage(parts)];
}

function normalizeReasoningEvent(
  event: ReasoningEventPayload
): UIMessage[] | null {
  const text =
    coerceNonEmptyString(event.text) ?? coerceNonEmptyString(event.reasoning);
  if (!text) {
    return null;
  }
  return [createAssistantMessage([{ type: "reasoning", text }])];
}

function normalizeDataStatusEvent(event: DataStatusEventPayload): UIMessage[] {
  const part = {
    type: "data-status",
    data: event.data,
    transient: Boolean(event.transient),
  } as MessagePart;
  return [createAssistantMessage([part])];
}

function normalizeDataCacheEvent(
  event: DataCacheEventPayload
): UIMessage[] | null {
  const receipt = coerceReceipt(event.receipts);
  if (!receipt) {
    return null;
  }
  const part: MessagePart = {
    type: "data-cache",
    data: {
      summary: receipt.summary,
      created: receipt.created.toISOString(),
      code: receipt.code ?? [],
      web: receipt.web ?? [],
      source: "cache-handoff",
    },
  };
  return [createAssistantMessage([part])];
}

function normalizeFileEvent(event: FileEventPayload): UIMessage[] | null {
  let url: string | undefined;
  if (typeof event.url === "string") {
    ({ url } = event);
  } else if (typeof event.data === "string") {
    url = event.data;
  }

  if (!url) {
    return null;
  }

  const filename = event.filename || event.name;
  const part: MessagePart = {
    type: "file",
    mediaType: event.mediaType || event.mimeType || "application/octet-stream",
    url,
    ...(filename ? { filename } : {}),
  };

  return [createAssistantMessage([part])];
}

function collectAssistantParts(event: AssistantEventPayload): MessagePart[] {
  const parts: MessagePart[] = [];

  const assistantText = coerceNonEmptyString(event.text);
  if (assistantText) {
    parts.push({ type: "text", text: assistantText });
  }

  const reasoning = coerceNonEmptyString(event.reasoning);
  if (reasoning) {
    parts.push({ type: "reasoning", text: reasoning });
  }

  if (Array.isArray(event.parts)) {
    for (const part of event.parts) {
      if (isMessagePart(part)) {
        parts.push(part);
      }
    }
  }

  if (Array.isArray(event.toolCalls)) {
    for (const call of event.toolCalls) {
      parts.push(createToolCallPart(call));
    }
  }

  if (Array.isArray(event.toolResults)) {
    for (const result of event.toolResults) {
      parts.push(createToolResultPart(result));
    }
  }

  return parts;
}

function coerceReceipt(value: unknown): SearchReceipt | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const receipt = value as Partial<SearchReceipt> & {
    created?: string | Date;
    code?: SearchReceipt["code"];
    web?: SearchReceipt["web"];
  };
  const createdRaw = receipt.created;
  const createdDate =
    createdRaw instanceof Date
      ? createdRaw
      : (typeof createdRaw === "string"
        ? new Date(createdRaw)
        : new Date());
  if (Number.isNaN(createdDate.getTime())) {
    return null;
  }
  return {
    code: Array.isArray(receipt.code) ? receipt.code : [],
    web: Array.isArray(receipt.web) ? receipt.web : undefined,
    created: createdDate,
    summary:
      typeof receipt.summary === "string"
        ? receipt.summary
        : "Context cache handoff",
  } satisfies SearchReceipt;
}

function createAssistantMessage(parts: MessagePart[]): UIMessage {
  return {
    id: randomUUID(),
    role: "assistant",
    parts,
  };
}

function createToolCallPart(call: ToolCallShape): MessagePart {
  return {
    type: "tool-call",
    toolName: inferToolName(call),
    toolCallId: inferToolCallId(call),
    input: getToolInput(call) ?? {},
  } as unknown as MessagePart;
}

function createToolResultPart(result: ToolResultShape): MessagePart {
  return {
    type: "tool-result",
    toolName: inferToolName(result),
    toolCallId: inferToolCallId(result),
    output: getToolOutput(result),
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

function getToolInput(shape: ToolCallShape | ToolResultShape): unknown {
  if (shape.args !== undefined) {
    return shape.args;
  }
  if (shape.input !== undefined) {
    return shape.input;
  }
  return;
}

function getToolOutput(shape: ToolResultShape): unknown {
  if (shape.result !== undefined) {
    return shape.result;
  }
  if (shape.output !== undefined) {
    return shape.output;
  }
  return;
}
