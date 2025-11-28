 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } 




const DEFAULT_MAX_CONTEXT_TOKENS = 128000;
const DEFAULT_HISTORY_RATIO = 0.5;

const MODEL_CONTEXT_TABLE = Object.freeze({
  "openai/gpt-4o": { maxContextTokens: 128000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4o-mini": { maxContextTokens: 128000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4.1": { maxContextTokens: 128000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4.1-mini": {
    maxContextTokens: 128000,
    defaultHistoryRatio: 0.5,
  },
  "openai/gpt-4.1-nano": { maxContextTokens: 64000, defaultHistoryRatio: 0.5 },
  "openai/o4-mini": { maxContextTokens: 128000, defaultHistoryRatio: 0.5 },
  "anthropic/claude-3-5-sonnet": {
    maxContextTokens: 200000,
    defaultHistoryRatio: 0.5,
  },
  "anthropic/claude-3-5-haiku": {
    maxContextTokens: 200000,
    defaultHistoryRatio: 0.5,
  },
});

let envOverridesCache = null;

function normalizeKey(modelId) {
  return _nullishCoalesce(_optionalChain([modelId, 'optionalAccess', _ => _.toLowerCase, 'call', _2 => _2()]), () => ( ""));
}

function loadEnvOverrides() {
  if (envOverridesCache) {
    return envOverridesCache;
  }

  const raw = process.env.HISTORY_MODEL_CONTEXT;
  if (!raw) {
    envOverridesCache = {};
    return envOverridesCache;
  }

  try {
    const parsed = JSON.parse(raw) ;
    const overrides = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key) {
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        overrides[normalizeKey(key)] = {
          maxContextTokens: Math.max(1, Math.trunc(value)),
        };
        continue;
      }
      if (value && typeof value === "object") {
        const maxContextTokens = Number(
          (value ).maxContextTokens
        );
        if (!Number.isFinite(maxContextTokens)) {
          continue;
        }
        const ratioRaw = (value )
          .defaultHistoryRatio;
        const ratio =
          typeof ratioRaw === "number" && Number.isFinite(ratioRaw)
            ? Math.max(0.05, Math.min(0.95, ratioRaw))
            : undefined;
        overrides[normalizeKey(key)] = {
          maxContextTokens: Math.max(1, Math.trunc(maxContextTokens)),
          defaultHistoryRatio: ratio,
        };
      }
    }
    envOverridesCache = overrides;
    return envOverridesCache;
  } catch (_error) {
    envOverridesCache = {};
    return envOverridesCache;
  }
}

export function resetModelContextOverrides() {
  envOverridesCache = null;
}

export function getModelContextInfo(modelId) {
  const key = normalizeKey(modelId);
  const overrides = loadEnvOverrides();
  const override = overrides[key];
  if (override) {
    return {
      maxContextTokens: override.maxContextTokens,
      defaultHistoryRatio:
        typeof override.defaultHistoryRatio === "number"
          ? override.defaultHistoryRatio
          : DEFAULT_HISTORY_RATIO,
    };
  }

  const defaultInfo = MODEL_CONTEXT_TABLE[key];
  if (defaultInfo) {
    return {
      maxContextTokens: defaultInfo.maxContextTokens,
      defaultHistoryRatio:
        typeof defaultInfo.defaultHistoryRatio === "number"
          ? defaultInfo.defaultHistoryRatio
          : DEFAULT_HISTORY_RATIO,
    };
  }

  return {
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    defaultHistoryRatio: DEFAULT_HISTORY_RATIO,
  };
}
