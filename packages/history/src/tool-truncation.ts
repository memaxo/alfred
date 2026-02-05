import type { createTokenEstimator } from "@alfred/metrics/token";
import type { UIMessage } from "@alfred/type/stream";

export type ToolResultRef = {
  kind: "agentfs_kv";
  runId: string;
  key: string;
} | null;

export interface TruncatedToolResult {
  summaryText: string;
  ref: ToolResultRef;
}

type Estimator = ReturnType<typeof createTokenEstimator>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJson(value: unknown, maxChars: number): string {
  try {
    const raw = JSON.stringify(value) ?? "";
    if (raw.length <= maxChars) {
      return raw;
    }
    // Guard: avoid runaway serialization sizes.
    return `${raw.slice(0, Math.max(0, maxChars - 1))}…`;
  } catch {
    const s = typeof value === "string" ? value : String(value);
    if (s.length <= maxChars) {
      return s;
    }
    return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
  }
}

function payloadTokenEstimate(estimator: Estimator, payload: unknown): number {
  // Avoid unbounded stringify. If we hit the maxChars guard, treat this as
  // “very large” so truncation is triggered conservatively.
  const maxChars = 200_000;
  const json = safeJson(payload, maxChars);
  const tokens = estimator.estimate(json);
  if (json.endsWith("…")) {
    return Math.max(tokens, 5000);
  }
  return tokens;
}

export function shouldTruncateToolResult(
  estimator: Estimator,
  part: UIMessage["parts"][number],
  maxTokens = 4000
): boolean {
  if (!part || typeof part !== "object") {
    return false;
  }
  const kind = (part as { type?: unknown }).type;
  if (kind !== "tool-result" && kind !== "dynamic-tool") {
    // Also handle template-literal tool parts: tool-${NAME}
    if (typeof kind !== "string" || !kind.startsWith("tool-")) {
      return false;
    }
  }

  const payload =
    (part as { output?: unknown }).output ??
    (part as { result?: unknown }).result;
  if (payload === undefined) {
    return false;
  }
  return payloadTokenEstimate(estimator, payload) > maxTokens;
}

export function summarizeToolPayload(payload: unknown): string {
  if (payload === null) {
    return "Truncated tool result (null).";
  }
  if (payload === undefined) {
    return "Truncated tool result (undefined).";
  }
  if (typeof payload === "string") {
    const lines = payload.split("\n").length;
    return `Truncated tool result (type=string, bytes=${payload.length}, lines=${lines}).`;
  }
  if (Array.isArray(payload)) {
    return `Truncated tool result (type=array, length=${payload.length}).`;
  }
  if (isRecord(payload)) {
    const keys = Object.keys(payload);
    const preview = keys.slice(0, 20).join(", ");
    const more = keys.length > 20 ? `, +${keys.length - 20} more` : "";
    return `Truncated tool result (type=object, keys=[${preview}${more}]).`;
  }
  return `Truncated tool result (type=${typeof payload}).`;
}

export function truncateToolPart(
  part: UIMessage["parts"][number],
  input: { summaryText: string; ref: ToolResultRef }
): UIMessage["parts"][number] {
  const kind =
    typeof (part as any)?.type === "string"
      ? (part as any).type
      : "tool-result";
  if (kind === "tool-result") {
    const p = part as any;
    return {
      ...p,
      output: {
        ref: input.ref,
        summaryText: input.summaryText,
      } satisfies TruncatedToolResult,
    };
  }

  // AI SDK v6 tool parts
  if (typeof kind === "string" && kind.startsWith("tool-")) {
    const p = part as any;
    return {
      ...p,
      output: {
        ref: input.ref,
        summaryText: input.summaryText,
      } satisfies TruncatedToolResult,
    };
  }

  return part;
}
