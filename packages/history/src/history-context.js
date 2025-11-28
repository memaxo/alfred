 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { createTokenEstimator } from "@alfred/agent/orchestrator/util/token";
import { withBudget } from "@alfred/metrics/performance";

import { convertToModelMessages, pruneMessages } from "ai";
import { getModelContextInfo } from "./model";








const DEFAULT_HISTORY_RATIO = 0.5;
const MIN_HISTORY_RATIO = 0.05;
const MAX_HISTORY_RATIO = 0.95;
const DEFAULT_MIN_SYSTEM_RESERVE = 2000;
const DEFAULT_MIN_HEADROOM = 2000;
const DEFAULT_RESERVED_TOOLING = 1000;
const HIGH_TIER_OVERDRAFT = 512;
const MEDIUM_TIER_OVERDRAFT = 256;

const ROLE_WEIGHTS = {
  user: 3,
  assistant: 2,
  tool: 1,
  system: 1,
};

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}






















export async function buildHistoryContext(
  options
) {
  const sourceLabel = _nullishCoalesce(options.source, () => ( "history"));
  return withBudget(`build_history_context_${sourceLabel}`, 10, async () => {
    const messages = (
      Array.isArray(options.messages) ? options.messages : []
    ).filter((m) => !!m);

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
    const latestToolChain = _nullishCoalesce(toolChains.at(-1), () => ( null));

    const anchorIndices = new Set();
    const idToIndex = new Map();

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
      if (prevAssistant >= 0 && _optionalChain([messages, 'access', _2 => _2[prevAssistant], 'optionalAccess', _3 => _3.role]) === "assistant") {
        anchorIndices.add(prevAssistant);
      }
      const previousUser = findLastIndexByRole(
        messages,
        "user",
        lastUserIndex - 1
      );
      if (previousUser !== -1) {
        const lastUserTokens = _nullishCoalesce(tokensByIndex[lastUserIndex], () => ( 0));
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

    const messageInfos = messages.map((message, index) => {
      const id = resolveMessageKey(message, index);
      const tokens = _nullishCoalesce(tokensByIndex[index], () => ( 0));
      const isAnchor = anchorIndices.has(index);
      const hasToolPart = messageHasToolPart(message);
      const tier = isAnchor
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
      const roleWeight = _nullishCoalesce(ROLE_WEIGHTS[_nullishCoalesce(message.role, () => ( "assistant"))], () => ( 1));
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
      const groupId = _nullishCoalesce(toolGroupMap.get(index), () => ( `msg-${index}`));
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

    const selectedIndices = new Set();
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
    const keptMessages = keptIndices
      .map((index) => messages[index])
      .filter((m) => !!m);
    const droppedMessages = messages.filter(
      (_, index) => !selectedIndices.has(index)
    );

    const droppedTokens = Math.max(totalTokens - keptTokens, 0);

    const tiers = new Map();
    const tierByMessage = new WeakMap();
    for (const info of messageInfos) {
      tiers.set(info.id, info.tier);
      tierByMessage.set(info.message, info.tier);
    }

    const selection = {
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
    } ;
  });
}

function emptyResult(
  options
) {
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
  options,
  modelContext,
  systemTokens
) {
  const overrides = _nullishCoalesce(options.budget, () => ( {}));
  const envHistoryRatio = parseEnvNumber(process.env.HISTORY_CONTEXT_RATIO);
  const envSystemReserve = parseEnvNumber(
    process.env.HISTORY_MIN_SYSTEM_RESERVE
  );
  const envHeadroom = parseEnvNumber(process.env.HISTORY_MIN_HEADROOM);

  let ratio =
    typeof overrides.historyRatio === "number"
      ? overrides.historyRatio
      : (_nullishCoalesce(_nullishCoalesce(envHistoryRatio, () => (
        modelContext.defaultHistoryRatio)), () => (
        DEFAULT_HISTORY_RATIO)));
  if (options.aggressive) {
    ratio -= 0.1;
  }
  ratio = clamp(ratio, MIN_HISTORY_RATIO, MAX_HISTORY_RATIO);

  const maxContextTokens =
    _nullishCoalesce(overrides.maxContextTokens, () => ( modelContext.maxContextTokens));
  const minSystemReserveTokens =
    _nullishCoalesce(_nullishCoalesce(overrides.minSystemReserveTokens, () => (
    envSystemReserve)), () => (
    DEFAULT_MIN_SYSTEM_RESERVE));
  const minHeadroomTokens =
    _nullishCoalesce(_nullishCoalesce(overrides.minHeadroomTokens, () => ( envHeadroom)), () => ( DEFAULT_MIN_HEADROOM));
  const reservedToolingTokens =
    _nullishCoalesce(overrides.reservedToolingTokens, () => ( DEFAULT_RESERVED_TOOLING));

  const historyWindow = Math.max(0, Math.floor(maxContextTokens * ratio));
  const systemReserve = Math.max(systemTokens, minSystemReserveTokens);
  const headroomTokens = minHeadroomTokens + reservedToolingTokens;
  const historyBudgetTokens = Math.max(
    historyWindow - (systemReserve + headroomTokens),
    0
  );

  return {
    historyBudgetTokens,
    systemTokens,
    headroomTokens,
    maxContextTokens,
  } 



;
}

function parseEnvNumber(raw) {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function estimateMessageTokens(
  estimator,
  message,
  _index
) {
  const textParts = Array.isArray(message.parts) ? message.parts : [];
  if (textParts.length === 0) {
    const fallback =
      typeof (message ).content === "string"
        ? (message ).content
        : "";
    return fallback ? estimator.estimate(fallback) : 0;
  }

  let total = 0;
  for (const part of textParts) {
    total += estimator.estimate(serializePart(part));
  }
  return total;
}

function serializePart(part) {
  const kind = typeof part.type === "string" ? part.type : "unknown";
  if (kind === "text" || kind === "reasoning") {
    return _nullishCoalesce((part ).text, () => ( ""));
  }
  if (kind === "file") {
    const filePart = part ;
    return `${_nullishCoalesce(_nullishCoalesce(filePart.filename, () => ( filePart.fileId)), () => ( "file"))}`;
  }
  if (kind === "source-url") {
    const sourcePart = part ;
    return `${_nullishCoalesce(sourcePart.title, () => ( "source-url"))}:${_nullishCoalesce(sourcePart.url, () => ( ""))}`;
  }
  if (kind === "source-document") {
    return safeJson(_nullishCoalesce((part ).document, () => ( {})));
  }
  if (kind === "data-status") {
    const dataPart = part ;
    return `${_nullishCoalesce(dataPart.status, () => ( "data-status"))}:${_nullishCoalesce(dataPart.target, () => ( ""))}`;
  }
  if (kind.includes("tool")) {
    const toolPart = part 





;
    const payload =
      _nullishCoalesce(_nullishCoalesce(_nullishCoalesce(_nullishCoalesce(toolPart.output, () => (
      toolPart.result)), () => (
      toolPart.input)), () => (
      toolPart.args)), () => (
      null));
    return `${_nullishCoalesce(toolPart.toolName, () => ( kind))}:${safeJson(payload)}`;
  }
  return safeJson(part);
}

function safeJson(value) {
  try {
    return _nullishCoalesce(JSON.stringify(value), () => ( ""));
  } catch (e) {
    return typeof value === "string" ? value : String(value);
  }
}

function normalizeForceKeep(
  forceKeep
) {
  if (!forceKeep) {
    return new Set();
  }
  if (forceKeep instanceof Set) {
    return new Set([...forceKeep].filter((value) => typeof value === "string"));
  }
  if (Array.isArray(forceKeep)) {
    return new Set(
      forceKeep.filter((value) => typeof value === "string")
    );
  }
  return new Set();
}

function findLastIndexByRole(
  messages,
  role,
  startIndex
) {
  for (
    let index =
      typeof startIndex === "number" ? startIndex : messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (_optionalChain([messages, 'access', _4 => _4[index], 'optionalAccess', _5 => _5.role]) === role) {
      return index;
    }
  }
  return -1;
}



function findToolChains(messages) {
  const chains = [];
  let current = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message && messageHasToolPart(message)) {
      if (current) {
        current.end = index;
      } else {
        current = { start: index, end: index };
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

function messageHasToolPart(message) {
  if (!Array.isArray(message.parts)) {
    return false;
  }
  return message.parts.some((part) => {
    const kind = typeof part.type === "string" ? part.type : "";
    return kind.includes("tool");
  });
}

function mapToolGroups(
  _messages,
  toolChains
) {
  const map = new Map();
  toolChains.forEach((chain, chainIndex) => {
    const id = `tool-chain-${chainIndex}`;
    for (let index = chain.start; index <= chain.end; index += 1) {
      map.set(index, id);
    }
  });
  return map;
}

function buildGroups(messageInfos) {
  const groups = new Map();
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

function pickHigherTier(a, b) {
  const order = ["low", "medium", "high", "anchor"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function getAllowedOverdraft(tier, budget) {
  if (budget <= 0) {
    return 0;
  }
  if (tier === "high") {
    return Math.min(HIGH_TIER_OVERDRAFT, Math.floor(budget * 0.2));
  }
  if (tier === "medium") {
    return Math.min(MEDIUM_TIER_OVERDRAFT, Math.floor(budget * 0.1));
  }
  return 0;
}

function resolveMessageKey(message, index) {
  return typeof message.id === "string" && message.id.length > 0
    ? message.id
    : `index:${index}`;
}
