/**
 * Shared reasoning accumulator utilities for tool execution
 *
 * Provides consistent handling of reasoning traces across tools
 * (Codex, Droid, etc.) without introducing interface abstractions.
 */

const BYTES_PER_KIBIBYTE = 1024;
const MEBIBYTES_COUNT = 5;
const DEFAULT_REASONING_CAP_BYTES =
  MEBIBYTES_COUNT * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE; // 5 MiB

/**
 * Accumulator for reasoning traces during tool execution
 */
export type ReasoningAccumulator = {
  traces: Array<{ text: string; timestamp: number }>;
  storedBytes: number;
  truncated: boolean;
};

/**
 * Create a fresh reasoning accumulator
 */
export function createReasoningAccumulator(): ReasoningAccumulator {
  return {
    traces: [],
    storedBytes: 0,
    truncated: false,
  };
}

/**
 * Append a reasoning trace to the accumulator with byte limit enforcement
 *
 * @param acc - The reasoning accumulator
 * @param text - The reasoning text to append
 * @param ts - Optional timestamp (defaults to Date.now())
 * @param capBytes - Optional byte cap (defaults to 5 MiB)
 */
export function appendReasoningTrace(
  acc: ReasoningAccumulator,
  text: string,
  ts?: number,
  capBytes = DEFAULT_REASONING_CAP_BYTES
): void {
  if (!text) {
    return;
  }

  const timestamp = ts ?? Date.now();
  const buffer = Buffer.from(text);
  const byteLength = buffer.byteLength;

  if (acc.truncated) {
    acc.storedBytes += byteLength;
    return;
  }

  const remaining = capBytes - acc.storedBytes;
  if (remaining <= 0) {
    acc.truncated = true;
    return;
  }

  if (byteLength <= remaining) {
    acc.traces.push({ text, timestamp });
    acc.storedBytes += byteLength;
  } else {
    const { text: truncatedText, usedBytes } = trimBufferToUtf8Boundary(
      buffer,
      remaining
    );

    if (truncatedText) {
      acc.traces.push({
        text: truncatedText,
        timestamp,
      });
    }

    acc.storedBytes += usedBytes;
    acc.truncated = true;
  }
}

/**
 * Extract reasoning text from a reasoning item payload
 * Handles various formats: {text}, {content: [{text}]}, etc.
 */
export function extractReasoningText(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as { text?: unknown; content?: unknown };

  if (typeof candidate.text === "string") {
    return candidate.text.trim();
  }

  if (Array.isArray(candidate.content)) {
    const parts = candidate.content
      .flatMap((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const text = (entry as { text?: unknown }).text;
        return typeof text === "string" ? text : [];
      })
      .filter((part): part is string => typeof part === "string");

    if (parts.length > 0) {
      return parts.join("\n").trim();
    }
  }

  return null;
}

/**
 * Persist reasoning traces to the knowledge graph
 *
 * @param resource - Resource identifier (e.g., working directory path)
 * @param traces - Array of reasoning traces from accumulator
 * @param ctx - Optional context with executionId, threadId, auto level
 */
export async function persistReasoning(
  resource: string,
  traces: ReasoningAccumulator["traces"],
  ctx?: {
    executionId?: string;
    threadId?: string;
    auto?: string;
  }
): Promise<void> {
  if (traces.length === 0) {
    return;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { persistReasoning: graphPersist } = await import(
      "../../../../assistant/src/graphstore"
    );
    await graphPersist(resource, traces, ctx);
  } catch (_error) {}
}

function trimBufferToUtf8Boundary(
  buffer: Buffer,
  maxBytes: number
): { text: string; usedBytes: number } {
  if (buffer.byteLength <= maxBytes) {
    return { text: buffer.toString("utf8"), usedBytes: buffer.byteLength };
  }

  let end = Math.min(maxBytes, buffer.byteLength);

  while (end > 0) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, end)
      );
      return { text, usedBytes: end };
    } catch {
      end -= 1;
    }
  }

  return { text: "", usedBytes: maxBytes };
}
