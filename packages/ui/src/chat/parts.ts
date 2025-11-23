import type { UIMessage } from "@alfred/type/stream";

export function isTextPart(
  part: UIMessage["parts"][number]
): part is { type: "text"; text: string } {
  if (part.type !== "text") {
    return false;
  }
  return typeof part.text === "string";
}

export function isReasoningPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "reasoning" }> {
  if (part.type !== "reasoning") {
    return false;
  }
  return typeof (part as { text?: unknown }).text === "string";
}

export function isToolCallPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: string }> & {
  type: "tool-call";
  toolName?: string;
  args?: unknown;
  toolCallId?: string;
} {
  return part.type === "tool-call";
}

export function isToolResultPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: string }> & {
  type: "tool-result";
  toolName?: string;
  result?: unknown;
  toolCallId?: string;
  isError?: boolean;
  errorText?: string;
} {
  return part.type === "tool-result";
}

export function isFilePart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "file" }> {
  if (part.type !== "file") {
    return false;
  }
  const filePart = part as { mediaType?: unknown; url?: unknown };
  return (
    typeof filePart.mediaType === "string" && typeof filePart.url === "string"
  );
}

export function isDataPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: `data-${string}` }> {
  return typeof part.type === "string" && part.type.startsWith("data-");
}

export function isDataCachePart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "data-cache" }> & {
  data: unknown;
  key?: readonly unknown[];
  value?: unknown;
} {
  return part.type === "data-cache";
}

export function isDataStatusPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "data-status" }> & {
  data: unknown;
  transient?: boolean;
} {
  return part.type === "data-status";
}

export function isDataPartNamed(
  part: UIMessage["parts"][number],
  name: string
): part is Extract<UIMessage["parts"][number], { type: `data-${string}` }> & {
  type: `data-${string}`;
  data?: unknown;
  id?: string;
} {
  return part.type === `data-${name}`;
}

export function extractStructuredData(
  part: UIMessage["parts"][number]
): unknown {
  if (isDataPart(part)) {
    const dataPart = part as { data?: unknown };
    return dataPart.data;
  }
  if (isToolResultPart(part)) {
    return part.result;
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
