import type { UIMessage } from "@alfred/type/stream";

export function isTextPart(
  part: UIMessage["parts"][number],
): part is { type: "text"; text: string } {
  return part.type === "text" && typeof (part as { text?: unknown }).text === "string";
}

export function isReasoningPart(
  part: UIMessage["parts"][number],
): part is { type: "reasoning"; reasoning: string } {
  return part.type === "reasoning" && typeof (part as { reasoning?: unknown }).reasoning === "string";
}

export function isToolCallPart(
  part: UIMessage["parts"][number],
): part is { type: "tool-call"; toolName?: string; args?: unknown; input?: unknown; toolCallId?: string } {
  return part.type === "tool-call";
}

export function isToolResultPart(
  part: UIMessage["parts"][number],
): part is { type: "tool-result"; toolName?: string; result?: unknown; toolCallId?: string } {
  return part.type === "tool-result";
}

export function isFilePart(
  part: UIMessage["parts"][number],
): part is { type: "file"; mimeType: string; data: string } {
  if (part.type !== "file") {
    return false;
  }
  const candidate = part as { mimeType?: unknown; data?: unknown };
  return typeof candidate.mimeType === "string" && typeof candidate.data === "string";
}

export function isDataPart(
  part: UIMessage["parts"][number],
): part is { type: "data"; data: unknown } {
  return part.type === "data";
}

export function isDataCachePart(
  part: UIMessage["parts"][number],
): part is { type: "data-cache"; key: readonly unknown[]; value: unknown } {
  return part.type === "data-cache";
}

export function isDataStatusPart(
  part: UIMessage["parts"][number],
): part is { type: "data-status"; data: unknown; transient?: boolean } {
  return part.type === "data-status";
}

function extractMetadata(message: UIMessage): Record<string, unknown> {
  const metadata = (message as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as Record<string, unknown>;
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
    case "tool":
      return "Tool";
    default:
      return message.role;
  }
}

export function getTimestamp(message: UIMessage): Date | null {
  const metadata = extractMetadata(message);
  const source = (metadata.completeAt ?? metadata.createdAt ?? metadata.created) as
    | string
    | number
    | Date
    | undefined;

  if (!source) {
    return null;
  }

  const date = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
