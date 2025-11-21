import { withBudget } from "@alfred/metrics/performance";
import { createTokenEstimator } from "@alfred/agent/orchestrator/util/token";
import type { UIMessage } from "@alfred/type/stream";
import { convertToModelMessages, pruneMessages } from "ai";
import { getModelContextInfo } from "./model";
import type {
  BuildHistoryContextOptions,
  BuildHistoryContextResult,
  HistoryBudget,
  HistorySelection,
  HistoryTier,
} from "./types";

const DEFAULT_HISTORY_RATIO = 0.5;
const MIN_HISTORY_RATIO = 0.05;
const MAX_HISTORY_RATIO = 0.95;
const DEFAULT_MIN_SYSTEM_RESERVE = 2_000;
const DEFAULT_MIN_HEADROOM = 2_000;
const DEFAULT_RESERVED_TOOLING = 1_000;
const HIGH_TIER_OVERDRAFT = 512;
const MEDIUM_TIER_OVERDRAFT = 256;

const ROLE_WEIGHTS: Record<string, number> = {
  user: 3,
  assistant: 2,
  tool: 1,
  system: 1,
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

type MessageInfo = {
  index: number;
  id: string;
  tokens: number;
  tier: HistoryTier;
  score: number;
  isAnchor: boolean;
  groupId: string;
  message: UIMessage;
};

type GroupInfo = {
  id: string;
  indices: number[];
  tokens: number;
  tier: HistoryTier;
  isAnchor: boolean;
  score: number;
  latestIndex: number;
};

export async function buildHistoryContext(
  options: BuildHistoryContextOptions
): Promise<BuildHistoryContextResult> {
  const sourceLabel = options.source ?? "history";
  return withBudget(`build_history_context_${sourceLabel}`, 10, async () => {
    const messages = Array.isArray(options.messages)
      ? [...options.messages]
      : [];

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
      const key = resolveMessageKey(messages[index], index);
      idToIndex.set(key, index);
    }

    const lastUserIndex = findLastIndexByRole(messages, "user");
    if (lastUserIndex !== -1) {
      anchorIndices.add(lastUserIndex);
      const prevAssistant = lastUserIndex - 1;
      if (prevAssistant >= 0 && messages[prevAssistant]?.role === "assistant") {
        anchorIndices.add(prevAssistant);
      }
      const previousUser = findLastIndexByRole(messages, "user", lastUserIndex - 1);
      if (previousUser !== -1) {
        const lastUserTokens = tokensByIndex[lastUserIndex] ?? 0;
        if (lastUserTokens < 64 || lastUserIndex - previousUser <= 2) {
          anchorIndices.add(previousUser);
        }
      }
    }

    if (latestToolChain) {
      for (let index = latestToolChain.start; index <= latestToolChain.end; index += 1) {
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
      if (latestToolChain && index >= latestToolChain.start - 1 && index <= latestToolChain.end + 1) {
        score += 1;
      }
      if (isAnchor) {
        score += 20;
      }
      const groupId = toolGroupMap.get(index) ?? `msg-${index}`;
      return {
        index,
        id,
        tokens,
        tier,
        score,
        isAnchor,
        groupId,
        message,
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

    const historyBudgetTokens = budget.historyBudgetTokens;

    const candidateGroups = groups
      .filter((group) => !group.isAnchor)
      .sort((a, b) => {
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

    const keptIndices = [...selectedIndices].sort((a, b) => a - b);
    const keptMessages = keptIndices.map((index) => messages[index]);
    const droppedMessages = messages.filter((_, index) => !selectedIndices.has(index));

    const droppedTokens = Math.max(totalTokens - keptTokens, 0);

    const tiers = new Map<string, HistoryTier>();
    const tierByMessage = new WeakMap<UIMessage, HistoryTier>();
    for (const info of messageInfos) {
      tiers.set(info.id, info.tier);
      tierByMessage.set(info.message, info.tier);
    }

    const selection: HistorySelection = {
      kept: keptMessages,
      dropped: droppedMessages,
      tiers,
      tierByMessage,
      keptTokens,
      droppedTokens,
      budget: {
        modelId: options.modelId,
        maxContextTokens: budget.maxContextTokens,
        historyBudgetTokens,
        systemTokens: budget.systemTokens,
        headroomTokens: budget.headroomTokens,
      },
    };

    const uiMessages = keptMessages;
    const modelMessages = uiMessages.length
      ? pruneMessages({
          messages: convertToModelMessages(uiMessages),
          emptyMessages: "remove",
        })
      : [];

    return {
      uiMessages,
      modelMessages,
      droppedMessages: droppedMessages.length,
      keptTokens,
      droppedTokens,
      selection,
    } satisfies BuildHistoryContextResult;
  });
}

function emptyResult(options: BuildHistoryContextOptions): BuildHistoryContextResult {
  return {
    uiMessages: [],
    modelMessages: [],
    droppedMessages: 0,
    keptTokens: 0,
    droppedTokens: 0,
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
  };
}

function resolveBudget(
  options: BuildHistoryContextOptions,
  modelContext: ReturnType<typeof getModelContextInfo>,
  systemTokens: number
) {
  const overrides = options.budget ?? {};
  const envHistoryRatio = parseEnvNumber(process.env.HISTORY_CONTEXT_RATIO);
  const envSystemReserve = parseEnvNumber(process.env.HISTORY_MIN_SYSTEM_RESERVE);
  const envHeadroom = parseEnvNumber(process.env.HISTORY_MIN_HEADROOM);

  let ratio =
    typeof overrides.historyRatio === "number"
      ? overrides.historyRatio
      : envHistoryRatio ?? modelContext.defaultHistoryRatio ?? DEFAULT_HISTORY_RATIO;
  if (options.aggressive) {
    ratio -= 0.1;
  }
  ratio = clamp(ratio, MIN_HISTORY_RATIO, MAX_HISTORY_RATIO);

  const maxContextTokens = overrides.maxContextTokens ?? modelContext.maxContextTokens;
  const minSystemReserveTokens =
    overrides.minSystemReserveTokens ?? envSystemReserve ?? DEFAULT_MIN_SYSTEM_RESERVE;
  const minHeadroomTokens =
    overrides.minHeadroomTokens ?? envHeadroom ?? DEFAULT_MIN_HEADROOM;
  const reservedToolingTokens =
    overrides.reservedToolingTokens ?? DEFAULT_RESERVED_TOOLING;

  const historyWindow = Math.max(0, Math.floor(maxContextTokens * ratio));
  const systemReserve = Math.max(systemTokens, minSystemReserveTokens);
  const headroomTokens = minHeadroomTokens + reservedToolingTokens;
  const historyBudgetTokens = Math.max(historyWindow - (systemReserve + headroomTokens), 0);

  return {
    historyBudgetTokens,
    systemTokens,
    headroomTokens,
    maxContextTokens,
  } satisfies Required<Pick<HistoryBudget, "maxContextTokens">> & {
    historyBudgetTokens: number;
    systemTokens: number;
    headroomTokens: number;
  };
}

function parseEnvNumber(raw: string | undefined): number | null {
  if (!raw) return null;
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
    const fallback = typeof (message as { content?: string }).content === "string"
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
      toolPart.output ?? toolPart.result ?? toolPart.input ?? toolPart.args ?? null;
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

function normalizeForceKeep(forceKeep: BuildHistoryContextOptions["forceKeepIds"]): Set<string> {
  if (!forceKeep) {
    return new Set();
  }
  if (forceKeep instanceof Set) {
    return new Set([...forceKeep].filter((value) => typeof value === "string"));
  }
  if (Array.isArray(forceKeep)) {
    return new Set(forceKeep.filter((value): value is string => typeof value === "string"));
  }
  return new Set();
}

function findLastIndexByRole(
  messages: readonly UIMessage[],
  role: UIMessage["role"],
  startIndex?: number
): number {
  for (
    let index = typeof startIndex === "number" ? startIndex : messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (messages[index]?.role === role) {
      return index;
    }
  }
  return -1;
}

type ToolChain = { start: number; end: number };

function findToolChains(messages: readonly UIMessage[]): ToolChain[] {
  const chains: ToolChain[] = [];
  let current: ToolChain | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (messageHasToolPart(message)) {
      if (!current) {
        current = { start: index, end: index };
      } else {
        current.end = index;
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
  if (message.role === "tool") {
    return true;
  }
  if (!Array.isArray(message.parts)) {
    return false;
  }
  return message.parts.some((part) => {
    const kind = typeof part.type === "string" ? part.type : "";
    return kind.includes("tool");
  });
}

function mapToolGroups(
  messages: readonly UIMessage[],
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
        tokens: info.tokens,
        tier: info.tier,
        isAnchor: info.isAnchor,
        score: info.score,
        latestIndex: info.index,
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

function getAllowedOverdraft(tier: HistoryTier, budget: number): number {
  if (budget <= 0) return 0;
  if (tier === "high") {
    return Math.min(HIGH_TIER_OVERDRAFT, Math.floor(budget * 0.2));
  }
  if (tier === "medium") {
    return Math.min(MEDIUM_TIER_OVERDRAFT, Math.floor(budget * 0.1));
  }
  return 0;
}

function resolveMessageKey(message: UIMessage, index: number): string {
  return typeof message.id === "string" && message.id.length > 0
    ? message.id
    : `index:${index}`;
}
