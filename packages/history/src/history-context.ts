import type { UIMessage } from "@alfred/type/stream";

import { withBudget } from "@alfred/metrics/performance";
import { createTokenEstimator } from "@alfred/metrics/token";
import { convertToModelMessages, pruneMessages } from "ai";

import type {
  BuildHistoryContextOptions,
  BuildHistoryContextResult,
  HistoryBudget,
  HistorySelection,
  HistoryTier,
} from "./types";

import { BUDGET_RATIOS } from "./calculator";
import {
  historyContextSelectionDurationSeconds,
  historyContextTierDropsTotal,
  historyContextTokensTotal,
  toolResultTruncatedTotal,
} from "./metrics";
import { getModelContextInfo } from "./model";
import {
  shouldTruncateToolResult,
  summarizeToolPayload,
  truncateToolPart,
} from "./tool-truncation";

/**
 * Research-backed budget constants (January 2025)
 *
 * Sources:
 * - "Lost in the Middle" (Liu et al., 2023): 55% utilization threshold
 * - Context Engineering Guide: 70% warn, 85% hard cap
 * - LLMLingua/LongLLMLingua: Compression budget controller patterns
 *
 * @see packages/history/src/calculator.ts for full rationale
 */
const { DEFAULT_HISTORY_RATIO } = BUDGET_RATIOS; // 0.55
const { MIN_HISTORY_RATIO } = BUDGET_RATIOS; // 0.15
const { MAX_HISTORY_RATIO } = BUDGET_RATIOS; // 0.75
const DEFAULT_MIN_SYSTEM_RESERVE = BUDGET_RATIOS.MIN_SYSTEM_RESERVE; // 2000 (scaled by model)
const DEFAULT_MIN_HEADROOM = BUDGET_RATIOS.MIN_HEADROOM; // 2000 (scaled by model)
const DEFAULT_RESERVED_TOOLING = BUDGET_RATIOS.MIN_TOOLING_RESERVE; // 1000 (scaled by model)
const HIGH_TIER_OVERDRAFT = BUDGET_RATIOS.MIN_HIGH_OVERDRAFT; // 512 (scaled by model)
const MEDIUM_TIER_OVERDRAFT = BUDGET_RATIOS.MIN_MEDIUM_OVERDRAFT; // 256 (scaled by model)

const ROLE_WEIGHTS: Record<string, number> = {
  assistant: 2,
  system: 1,
  tool: 1,
  user: 3,
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

interface MessageInfo {
  index: number;
  id: string;
  tokens: number;
  tier: HistoryTier;
  score: number;
  isAnchor: boolean;
  groupId: string;
  message: UIMessage;
}

interface GroupInfo {
  id: string;
  indices: number[];
  tokens: number;
  tier: HistoryTier;
  isAnchor: boolean;
  score: number;
  latestIndex: number;
}

export async function buildHistoryContext(
  options: BuildHistoryContextOptions
): Promise<BuildHistoryContextResult> {
  const sourceLabel = options.source ?? "history";

  await Promise.resolve();
  let messages = (
    Array.isArray(options.messages) ? options.messages : []
  ).filter((m): m is UIMessage => !!m);

  if (messages.length === 0) {
    return emptyResult(options);
  }

  const estimator = createTokenEstimator({ model: options.modelId });
  const modelContext = getModelContextInfo(options.modelId);
  const budget = resolveBudget(
    options,
    modelContext,
    options.system ? estimator.estimate(options.system) : 0
  );

  // Tool truncation happens before compression/selection so both token
  // estimation and returned UI messages are bounded.
  const truncationEnabled = process.env.CONTEXT_TOOL_TRUNCATION_ENABLED !== "0";
  if (truncationEnabled) {
    let changed = false;
    const next: UIMessage[] = [];
    for (const message of messages) {
      if (!Array.isArray(message.parts) || message.parts.length === 0) {
        next.push(message);
        continue;
      }
      let msgChanged = false;
      const parts: UIMessage["parts"] = [];
      for (const part of message.parts) {
        if (!shouldTruncateToolResult(estimator, part, 4000)) {
          parts.push(part);
          continue;
        }
        msgChanged = true;
        const toolName =
          typeof (part as any)?.toolName === "string"
            ? String((part as any).toolName)
            : "unknown";
        const payload =
          (part as any).output ??
          (part as any).result ??
          (part as any).input ??
          null;
        toolResultTruncatedTotal.inc({
          source: sourceLabel,
          stored: "none",
          toolName,
        });
        parts.push(
          truncateToolPart(part, {
            ref: null,
            summaryText: summarizeToolPayload(payload),
          })
        );
      }
      if (msgChanged) {
        changed = true;
        next.push({ ...message, parts });
      } else {
        next.push(message);
      }
    }
    if (changed) {
      messages = next;
    }
  }

  const compressionEnabled = process.env.CONTEXT_COMPRESSION_ENABLED === "1";
  if (compressionEnabled) {
    const { compressHistoryMessages } = await import("./compression");
    const compressed = await withBudget(
      `build_history_context_compression_${sourceLabel}`,
      100,
      async () =>
        compressHistoryMessages({
          budgetTokens: budget.historyBudgetTokens,
          messages,
          modelId: options.modelId,
          source: sourceLabel,
          thresholdRatio: 0.92,
        })
    );
    if (compressed.changed) {
      ({ messages } = compressed);
    }
  }

  const selectionStart = performance.now();

  const result = await withBudget(
    `build_history_context_selection_${sourceLabel}`,
    10,
    async () => {
      const tokensByIndex = messages.map((message, index) =>
        estimateMessageTokens(estimator, message, index)
      );
      const totalTokens = tokensByIndex.reduce((sum, value) => sum + value, 0);

      const forceKeep = normalizeForceKeep(options.forceKeepIds);
      const toolChains = findToolChains(messages);
      const latestToolChain = toolChains.at(-1) ?? null;

      const anchorIndices = new Set<number>();
      const idToIndex = new Map<string, number>();

      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (!message) {
          continue;
        }
        const key = resolveMessageKey(message, index);
        idToIndex.set(key, index);
      }

      const lastUserIndex = findLastIndexByRole(messages, "user");
      if (lastUserIndex !== -1) {
        anchorIndices.add(lastUserIndex);
        const prevAssistant = lastUserIndex - 1;
        if (
          prevAssistant >= 0 &&
          messages[prevAssistant]?.role === "assistant"
        ) {
          anchorIndices.add(prevAssistant);
        }
        const previousUser = findLastIndexByRole(
          messages,
          "user",
          lastUserIndex - 1
        );
        if (previousUser !== -1) {
          const lastUserTokens = tokensByIndex[lastUserIndex] ?? 0;
          if (lastUserTokens < 64 || lastUserIndex - previousUser <= 2) {
            anchorIndices.add(previousUser);
          }
        }
      }

      if (latestToolChain) {
        for (
          let index = latestToolChain.start;
          index <= latestToolChain.end;
          index += 1
        ) {
          anchorIndices.add(index);
        }
      }

      if (forceKeep.size > 0) {
        for (const key of forceKeep) {
          const index = idToIndex.get(key);
          if (typeof index === "number") {
            anchorIndices.add(index);
          }
        }
      }

      const toolGroupMap = mapToolGroups(messages, toolChains);

      const messageInfos: MessageInfo[] = messages.map((message, index) => {
        const id = resolveMessageKey(message, index);
        const tokens = tokensByIndex[index] ?? 0;
        const isAnchor = anchorIndices.has(index);
        const hasToolPart = messageHasToolPart(message);
        const tier: HistoryTier = isAnchor
          ? "anchor"
          : message.role === "user"
            ? "high"
            : hasToolPart
              ? "medium"
              : message.role === "assistant"
                ? "medium"
                : "low";
        const recencyWeight = (index + 1) / messages.length;
        const agePenalty = (messages.length - index - 1) / messages.length;
        const roleWeight = ROLE_WEIGHTS[message.role ?? "assistant"] ?? 1;
        let score = roleWeight * 2 + recencyWeight * 3 - agePenalty;
        if (hasToolPart) {
          score += 0.5;
        }
        if (
          latestToolChain &&
          index >= latestToolChain.start - 1 &&
          index <= latestToolChain.end + 1
        ) {
          score += 1;
        }
        if (isAnchor) {
          score += 20;
        }
        const groupId = toolGroupMap.get(index) ?? `msg-${index}`;
        return {
          groupId,
          id,
          index,
          isAnchor,
          message,
          score,
          tier,
          tokens,
        };
      });

      const groups = buildGroups(messageInfos);

      const selectedIndices = new Set<number>();
      let keptTokens = 0;

      const anchorGroups = groups.filter((group) => group.isAnchor);
      for (const group of anchorGroups) {
        for (const index of group.indices) {
          selectedIndices.add(index);
        }
        keptTokens += group.tokens;
      }

      const { historyBudgetTokens } = budget;

      const candidateGroups = groups
        .filter((group) => !group.isAnchor)
        .toSorted((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return b.latestIndex - a.latestIndex;
        });

      for (const group of candidateGroups) {
        if (group.indices.every((index) => selectedIndices.has(index))) {
          continue;
        }

        const remaining = historyBudgetTokens - keptTokens;
        const overdraft = getAllowedOverdraft(group.tier, historyBudgetTokens);
        if (group.tokens > remaining) {
          if (remaining <= 0 && overdraft <= 0) {
            continue;
          }
          if (group.tokens - remaining > overdraft) {
            continue;
          }
        }

        for (const index of group.indices) {
          selectedIndices.add(index);
        }
        keptTokens += group.tokens;
      }

      const keptIndices = [...selectedIndices].toSorted((a, b) => a - b);
      const keptMessages = keptIndices
        .map((index) => messages[index])
        .filter((m): m is UIMessage => !!m);
      const droppedMessages = messages.filter(
        (_, index) => !selectedIndices.has(index)
      );

      const droppedTokens = Math.max(totalTokens - keptTokens, 0);

      const tiers = new Map<string, HistoryTier>();
      const tierByMessage = new WeakMap<UIMessage, HistoryTier>();
      for (const info of messageInfos) {
        tiers.set(info.id, info.tier);
        tierByMessage.set(info.message, info.tier);
      }

      const selection: HistorySelection = {
        budget: {
          modelId: options.modelId,
          maxContextTokens: budget.maxContextTokens,
          historyBudgetTokens,
          systemTokens: budget.systemTokens,
          headroomTokens: budget.headroomTokens,
        },
        dropped: droppedMessages,
        droppedTokens,
        kept: keptMessages,
        keptTokens,
        tierByMessage,
        tiers,
      };

      const uiMessages = keptMessages;
      const modelMessagesRaw =
        uiMessages.length === 0
          ? []
          : (options.tools
            ? convertToModelMessages(uiMessages, { tools: options.tools })
            : convertToModelMessages(uiMessages));

      const modelMessages =
        modelMessagesRaw.length === 0
          ? []
          : pruneMessages({
              emptyMessages: "remove",
              messages: modelMessagesRaw,
            });

      const out = {
        droppedMessages: droppedMessages.length,
        droppedTokens,
        keptTokens,
        modelMessages,
        selection,
        uiMessages,
      } satisfies BuildHistoryContextResult;

      historyContextTokensTotal.inc(
        { action: "selection", model: options.modelId, source: sourceLabel },
        keptTokens
      );

      if (droppedMessages.length > 0) {
        for (const msg of droppedMessages) {
          const tier = tierByMessage.get(msg) ?? "low";
          historyContextTierDropsTotal.inc({ source: sourceLabel, tier });
        }
      }

      return out;
    }
  );

  historyContextSelectionDurationSeconds.observe(
    { source: sourceLabel },
    (performance.now() - selectionStart) / 1000
  );

  return result;
}

function emptyResult(
  options: BuildHistoryContextOptions
): BuildHistoryContextResult {
  return {
    droppedMessages: 0,
    droppedTokens: 0,
    keptTokens: 0,
    modelMessages: [],
    selection: {
      kept: [],
      dropped: [],
      tiers: new Map(),
      tierByMessage: new WeakMap(),
      keptTokens: 0,
      droppedTokens: 0,
      budget: {
        modelId: options.modelId,
        maxContextTokens: 0,
        historyBudgetTokens: 0,
        systemTokens: 0,
        headroomTokens: 0,
      },
    },
    uiMessages: [],
  };
}

function resolveBudget(
  options: BuildHistoryContextOptions,
  modelContext: ReturnType<typeof getModelContextInfo>,
  systemTokens: number
) {
  const overrides = options.budget ?? {};
  const envHistoryRatio = parseEnvNumber(process.env.HISTORY_CONTEXT_RATIO);
  const envSystemReserve = parseEnvNumber(
    process.env.HISTORY_MIN_SYSTEM_RESERVE
  );
  const envHeadroom = parseEnvNumber(process.env.HISTORY_MIN_HEADROOM);

  // Allow env/option overrides for backward compatibility
  let ratio =
    typeof overrides.historyRatio === "number"
      ? overrides.historyRatio
      : (envHistoryRatio ??
        modelContext.defaultHistoryRatio ??
        DEFAULT_HISTORY_RATIO);
  if (options.aggressive) {
    ratio -= BUDGET_RATIOS.AGGRESSIVE_REDUCTION;
  }
  ratio = clamp(ratio, MIN_HISTORY_RATIO, MAX_HISTORY_RATIO);

  const maxContextTokens =
    overrides.maxContextTokens ?? modelContext.maxContextTokens;

  // Scale reserves based on context window (research-backed ratios)
  // For models with larger context windows, use percentage-based scaling
  const scaledSystemReserve = Math.max(
    DEFAULT_MIN_SYSTEM_RESERVE,
    Math.floor(maxContextTokens * BUDGET_RATIOS.SYSTEM_RESERVE_RATIO)
  );
  const scaledHeadroom = Math.max(
    DEFAULT_MIN_HEADROOM,
    Math.floor(maxContextTokens * BUDGET_RATIOS.HEADROOM_RATIO)
  );
  const scaledTooling = Math.max(
    DEFAULT_RESERVED_TOOLING,
    Math.floor(maxContextTokens * BUDGET_RATIOS.TOOLING_RESERVE_RATIO)
  );

  // Allow explicit overrides to take precedence
  const minSystemReserveTokens =
    overrides.minSystemReserveTokens ?? envSystemReserve ?? scaledSystemReserve;
  const minHeadroomTokens =
    overrides.minHeadroomTokens ?? envHeadroom ?? scaledHeadroom;
  const reservedToolingTokens =
    overrides.reservedToolingTokens ?? scaledTooling;

  const historyWindow = Math.max(0, Math.floor(maxContextTokens * ratio));
  const systemReserve = Math.max(systemTokens, minSystemReserveTokens);
  const headroomTokens = minHeadroomTokens + reservedToolingTokens;
  const historyBudgetTokens = Math.max(
    historyWindow - (systemReserve + headroomTokens),
    0
  );

  return {
    headroomTokens,
    historyBudgetTokens,
    maxContextTokens,
    systemTokens,
  } satisfies Required<Pick<HistoryBudget, "maxContextTokens">> & {
    historyBudgetTokens: number;
    systemTokens: number;
    headroomTokens: number;
  };
}

function parseEnvNumber(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function estimateMessageTokens(
  estimator: ReturnType<typeof createTokenEstimator>,
  message: UIMessage,
  _index: number
): number {
  const textParts = Array.isArray(message.parts) ? message.parts : [];
  if (textParts.length === 0) {
    const fallback =
      typeof (message as { content?: string }).content === "string"
        ? (message as { content?: string }).content
        : "";
    return fallback ? estimator.estimate(fallback) : 0;
  }

  let total = 0;
  for (const part of textParts) {
    total += estimator.estimate(serializePart(part));
  }
  return total;
}

function serializePart(part: UIMessage["parts"][number]): string {
  const kind = typeof part.type === "string" ? part.type : "unknown";
  if (kind === "text" || kind === "reasoning") {
    return (part as { text?: string }).text ?? "";
  }
  if (kind === "file") {
    const filePart = part as { filename?: string; fileId?: string };
    return `${filePart.filename ?? filePart.fileId ?? "file"}`;
  }
  if (kind === "source-url") {
    const sourcePart = part as { title?: string; url?: string };
    return `${sourcePart.title ?? "source-url"}:${sourcePart.url ?? ""}`;
  }
  if (kind === "source-document") {
    return safeJson((part as { document?: unknown }).document ?? {});
  }
  if (kind === "data-status") {
    const dataPart = part as { status?: string; target?: string };
    return `${dataPart.status ?? "data-status"}:${dataPart.target ?? ""}`;
  }
  if (kind.includes("tool")) {
    const toolPart = part as {
      toolName?: string;
      input?: unknown;
      args?: unknown;
      output?: unknown;
      result?: unknown;
    };
    const payload =
      toolPart.output ??
      toolPart.result ??
      toolPart.input ??
      toolPart.args ??
      null;
    return `${toolPart.toolName ?? kind}:${safeJson(payload)}`;
  }
  return safeJson(part);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return typeof value === "string" ? value : String(value);
  }
}

function normalizeForceKeep(
  forceKeep: BuildHistoryContextOptions["forceKeepIds"]
): Set<string> {
  if (!forceKeep) {
    return new Set();
  }
  if (forceKeep instanceof Set) {
    return new Set([...forceKeep].filter((value) => typeof value === "string"));
  }
  if (Array.isArray(forceKeep)) {
    return new Set(
      forceKeep.filter((value): value is string => typeof value === "string")
    );
  }
  return new Set();
}

function findLastIndexByRole(
  messages: readonly UIMessage[],
  role: UIMessage["role"],
  startIndex?: number
): number {
  for (
    let index =
      typeof startIndex === "number" ? startIndex : messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (messages[index]?.role === role) {
      return index;
    }
  }
  return -1;
}

interface ToolChain {
  start: number;
  end: number;
}

function findToolChains(messages: readonly UIMessage[]): ToolChain[] {
  const chains: ToolChain[] = [];
  let current: ToolChain | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message && messageHasToolPart(message)) {
      if (current) {
        current.end = index;
      } else {
        current = { end: index, start: index };
      }
    } else if (current) {
      chains.push(current);
      current = null;
    }
  }
  if (current) {
    chains.push(current);
  }
  return chains;
}

function messageHasToolPart(message: UIMessage): boolean {
  if (!Array.isArray(message.parts)) {
    return false;
  }
  return message.parts.some((part) => {
    const kind = typeof part.type === "string" ? part.type : "";
    return kind.includes("tool");
  });
}

function mapToolGroups(
  _messages: readonly UIMessage[],
  toolChains: ToolChain[]
): Map<number, string> {
  const map = new Map<number, string>();
  toolChains.forEach((chain, chainIndex) => {
    const id = `tool-chain-${chainIndex}`;
    for (let index = chain.start; index <= chain.end; index += 1) {
      map.set(index, id);
    }
  });
  return map;
}

function buildGroups(messageInfos: MessageInfo[]): GroupInfo[] {
  const groups = new Map<string, GroupInfo>();
  for (const info of messageInfos) {
    const existing = groups.get(info.groupId);
    if (!existing) {
      groups.set(info.groupId, {
        id: info.groupId,
        indices: [info.index],
        isAnchor: info.isAnchor,
        latestIndex: info.index,
        score: info.score,
        tier: info.tier,
        tokens: info.tokens,
      });
      continue;
    }
    existing.indices.push(info.index);
    existing.tokens += info.tokens;
    existing.isAnchor = existing.isAnchor || info.isAnchor;
    existing.tier = pickHigherTier(existing.tier, info.tier);
    existing.score = Math.max(existing.score, info.score);
    existing.latestIndex = Math.max(existing.latestIndex, info.index);
  }
  return [...groups.values()];
}

function pickHigherTier(a: HistoryTier, b: HistoryTier): HistoryTier {
  const order: HistoryTier[] = ["low", "medium", "high", "anchor"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

/**
 * Get allowed overdraft for a message tier.
 *
 * Research-backed ratios:
 * - High tier (user messages): 2% of budget, min 512 tokens
 * - Medium tier (assistant/tool): 1% of budget, min 256 tokens
 * - Low tier: no overdraft
 *
 * The percentage caps ensure overdraft scales with context window
 * while the fixed minimums ensure small models still have reasonable
 * overdraft allowances.
 */
function getAllowedOverdraft(tier: HistoryTier, budget: number): number {
  if (budget <= 0) {
    return 0;
  }
  if (tier === "high") {
    // 2% of budget, bounded by min/max
    return Math.max(
      HIGH_TIER_OVERDRAFT,
      Math.min(
        Math.floor(budget * BUDGET_RATIOS.HIGH_TIER_OVERDRAFT_RATIO),
        4000 // Cap at 4k for very large contexts
      )
    );
  }
  if (tier === "medium") {
    // 1% of budget, bounded by min/max
    return Math.max(
      MEDIUM_TIER_OVERDRAFT,
      Math.min(
        Math.floor(budget * BUDGET_RATIOS.MEDIUM_TIER_OVERDRAFT_RATIO),
        2000 // Cap at 2k for very large contexts
      )
    );
  }
  return 0;
}

function resolveMessageKey(message: UIMessage, index: number): string {
  return typeof message.id === "string" && message.id.length > 0
    ? message.id
    : `index:${index}`;
}
