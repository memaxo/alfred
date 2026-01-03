import type { UIMessage } from "@alfred/type/stream";
import type { HistoryBudget } from "./types";

const DEFAULT_MIN_SYSTEM_RESERVE = 2000;
const DEFAULT_MIN_HEADROOM = 2000;

// Approximate token count (4 chars ~= 1 token for English text)
const CHARS_PER_TOKEN = 4;

function parseEnvNumber(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function getHistoryBudgetDefaults(): Partial<HistoryBudget> {
  const ratio = parseEnvNumber(process.env.HISTORY_CONTEXT_RATIO);
  const minSystem = parseEnvNumber(process.env.HISTORY_MIN_SYSTEM_RESERVE);
  const minHeadroom = parseEnvNumber(process.env.HISTORY_MIN_HEADROOM);

  const overrides: Partial<HistoryBudget> = {};
  if (typeof ratio === "number") {
    overrides.historyRatio = ratio;
  }
  overrides.minSystemReserveTokens =
    typeof minSystem === "number" ? minSystem : DEFAULT_MIN_SYSTEM_RESERVE;
  overrides.minHeadroomTokens =
    typeof minHeadroom === "number" ? minHeadroom : DEFAULT_MIN_HEADROOM;
  return overrides;
}

export function mergeHistoryBudget(
  overrides?: Partial<HistoryBudget>
): Partial<HistoryBudget> {
  if (!overrides) {
    return getHistoryBudgetDefaults();
  }
  return {
    ...getHistoryBudgetDefaults(),
    ...overrides,
  };
}

/**
 * Message role segment type for budget tracking.
 */
export type BudgetSegment = "system" | "user" | "assistant";

/**
 * Budget usage by segment type.
 */
export type BudgetUsage = {
  system: number;
  user: number;
  assistant: number;
  total: number;
  breakdown: {
    segment: BudgetSegment;
    tokens: number;
    percentage: number;
  }[];
  maxBudget: number;
  usagePercentage: number;
  remaining: number;
};

/**
 * Estimate token count from text content.
 */
function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Extract text content from a UIMessage.
 * UIMessage in AI SDK v6 has a `parts` array containing content parts.
 */
function extractMessageContent(message: UIMessage): string {
  // Handle parts array (AI SDK v6 format)
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          // Handle text parts
          if ("text" in part) {
            return (part as { text: string }).text;
          }
          // Handle tool-call parts (serialize as JSON for token counting)
          if ("toolName" in part) {
            return JSON.stringify(part);
          }
          // Handle tool-result parts
          if ("toolCallId" in part && "output" in part) {
            const output = (part as { output?: unknown }).output;
            return typeof output === "string" ? output : JSON.stringify(output);
          }
        }
        return "";
      })
      .join(" ");
  }

  return "";
}

/**
 * Compute actual token usage by segment from conversation messages.
 *
 * @param messages - Array of UI messages from the conversation
 * @param maxBudget - Maximum token budget (defaults to model context window)
 * @param systemPrompt - Optional system prompt to include in calculation
 * @returns Budget usage breakdown by segment
 */
export function computeBudgetUsage(
  messages: readonly UIMessage[],
  maxBudget = 128_000,
  systemPrompt?: string
): BudgetUsage {
  let systemTokens = 0;
  let userTokens = 0;
  let assistantTokens = 0;

  // Count system prompt tokens
  if (systemPrompt) {
    systemTokens = estimateTokens(systemPrompt);
  }

  // Count message tokens by role
  // UIMessage.role is "user" | "assistant" | "system" in AI SDK v6
  for (const message of messages) {
    const content = extractMessageContent(message);
    const tokens = estimateTokens(content);

    switch (message.role) {
      case "system":
        systemTokens += tokens;
        break;
      case "user":
        userTokens += tokens;
        break;
      case "assistant":
        assistantTokens += tokens;
        break;
    }
  }

  const total = systemTokens + userTokens + assistantTokens;
  const usagePercentage = maxBudget > 0 ? (total / maxBudget) * 100 : 0;
  const remaining = Math.max(0, maxBudget - total);

  const allSegments: { segment: BudgetSegment; tokens: number }[] = [
    { segment: "system", tokens: systemTokens },
    { segment: "user", tokens: userTokens },
    { segment: "assistant", tokens: assistantTokens },
  ];

  const breakdown = allSegments
    .filter((b) => b.tokens > 0)
    .map((b) => ({
      segment: b.segment,
      tokens: b.tokens,
      percentage: total > 0 ? (b.tokens / total) * 100 : 0,
    }));

  return {
    system: systemTokens,
    user: userTokens,
    assistant: assistantTokens,
    total,
    breakdown,
    maxBudget,
    usagePercentage,
    remaining,
  };
}
