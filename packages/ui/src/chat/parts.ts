import type { UIMessage } from "@alfred/type/stream";

import {
  isGenUIToolResult,
  isUIDataPart,
  type UIComponent,
} from "@alfred/type/genui";

type UIPart = UIMessage["parts"][number];

/**
 * ALFRED UI message part types.
 *
 * ALFRED extends the AI SDK UIMessage format to include explicit tool-call
 * and tool-result part types for cleaner serialization and persistence.
 *
 * These types are used for narrowing after type guard checks.
 *
 * ## Type Casting Note
 *
 * Consumers may need to use `as unknown as ToolCallPart` after type guards
 * when the source type is `UIMessagePart` from AI SDK. This is because:
 *
 * 1. AI SDK's `ToolUIPart` uses `type: "tool-${toolName}"` (template literal)
 * 2. ALFRED uses `type: "tool-call"` and `type: "tool-result"` (literal strings)
 *
 * The type guards check runtime values correctly, but TypeScript's type system
 * can't reconcile the structural mismatch at compile time. See `.ruler/15-ai-sdk-v6.md`
 * for full documentation of ALFRED's custom UIMessage format.
 */

export type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
};

export type ToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
};

export type ToolInvocationState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolInvocationPart = {
  type: `tool-${string}` | "dynamic-tool";
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for text parts.
 */
export function isTextPart(
  part: unknown
): part is { type: "text"; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "text"
  );
}

/**
 * Type guard for reasoning parts.
 */
export function isReasoningPart(
  part: unknown
): part is { type: "reasoning"; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "reasoning"
  );
}

/**
 * Type guard for tool-call parts.
 * ALFRED uses explicit tool-call types in UI messages.
 */
export function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "tool-call"
  );
}

/**
 * Type guard for tool-result parts.
 * ALFRED uses explicit tool-result types in UI messages.
 */
export function isToolResultPart(part: unknown): part is ToolResultPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "tool-result"
  );
}

/**
 * Type guard for AI SDK v6 tool invocation parts (tool-${toolName}) and dynamic tool invocations.
 */
export function isToolInvocationPart(
  part: unknown
): part is ToolInvocationPart {
  if (!isRecord(part)) {
    return false;
  }

  const type = part.type;
  if (typeof type !== "string") {
    return false;
  }

  if (
    type !== "dynamic-tool" &&
    (type === "tool-call" ||
      type === "tool-result" ||
      type === "tool-approval-request" ||
      !type.startsWith("tool-"))
  ) {
    return false;
  }

  return typeof part.toolCallId === "string";
}

export function getToolInvocationName(part: ToolInvocationPart): string {
  if (part.type === "dynamic-tool") {
    return typeof part.toolName === "string" && part.toolName.length > 0
      ? part.toolName
      : "tool";
  }

  return part.type.slice("tool-".length) || "tool";
}

const toolStates = new Set<string>([
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "output-available",
  "output-error",
  "output-denied",
]);

export function getToolInvocationState(
  part: ToolInvocationPart
): ToolInvocationState {
  if (typeof part.state === "string" && toolStates.has(part.state)) {
    return part.state as ToolInvocationState;
  }

  const approval = part.approval;
  if (approval && typeof approval === "object") {
    const id = (approval as { id?: unknown }).id;
    const approved = (approval as { approved?: unknown }).approved;

    if (typeof id === "string" && id.length > 0) {
      if (approved === undefined) {
        return "approval-requested";
      }
      if (approved === false) {
        return "output-denied";
      }
      if (approved === true) {
        return "approval-responded";
      }
    }
  }

  if (typeof part.errorText === "string" && part.errorText.length > 0) {
    return "output-error";
  }

  if (part.output !== undefined) {
    return "output-available";
  }

  if (part.input !== undefined) {
    return "input-available";
  }

  return "input-streaming";
}

/**
 * Type guard for file parts.
 */
export function isFilePart(
  part: unknown
): part is { type: "file"; mediaType: string; url: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "file"
  );
}

/**
 * Type guard for any data-* part.
 */
export function isDataPart(
  part: unknown
): part is { type: `data-${string}`; data: unknown } {
  if (typeof part !== "object" || part === null) {
    return false;
  }
  const type = (part as { type?: unknown }).type;
  return typeof type === "string" && type.startsWith("data-");
}

/**
 * Type guard for data-cache parts.
 */
export function isDataCachePart(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "data-cache"
  );
}

/**
 * Type guard for data-status parts.
 */
export function isDataStatusPart(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "data-status"
  );
}

/**
 * Type guard for named data parts.
 */
export function isDataPartNamed(part: unknown, name: string): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === `data-${name}`
  );
}

/**
 * Extracts structured data from data parts or tool results.
 */
export function extractStructuredData(part: UIPart): unknown {
  if (isDataPart(part)) {
    return (part as { data?: unknown }).data;
  }
  if (isToolResultPart(part)) {
    return (part as { output?: unknown }).output;
  }
  return null;
}

/**
 * Extract a GenUI schema from a message part.
 *
 * Supports:
 * - `data-ui` parts: `{ type: "data-ui", ui: UIComponent }`
 * - tool-result outputs: `{ output: { ui: UIComponent, data: unknown } }`
 */
export function extractGenUISchema(part: UIPart): UIComponent | null {
  if (isUIDataPart(part)) {
    return part.ui;
  }
  if (isToolResultPart(part)) {
    const output = (part as { output?: unknown }).output;
    if (isGenUIToolResult(output)) {
      return output.ui;
    }
  }
  return null;
}

function extractMetadata(message: UIMessage): Record<string, unknown> {
  if (!message.metadata || typeof message.metadata !== "object") {
    return {};
  }
  return message.metadata as Record<string, unknown>;
}

export function getAgentLabel(message: UIMessage): string {
  const metadata = extractMetadata(message);
  const agent = typeof metadata.agent === "string" ? metadata.agent : null;
  if (agent && agent.length > 0) {
    return agent;
  }
  switch (message.role) {
    case "system":
      return "System";
    case "assistant":
      return "Assistant";
    case "user":
      return "User";
    default:
      return String(message.role);
  }
}

export function getTimestamp(message: UIMessage): Date | null {
  const metadata = extractMetadata(message);
  const source = (metadata.completeAt ??
    metadata.createdAt ??
    metadata.created) as string | number | Date | undefined;

  if (!source) {
    return null;
  }

  const date = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
