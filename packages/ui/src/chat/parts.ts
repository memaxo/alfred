import type { UIMessage } from "@alfred/type/stream";

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
