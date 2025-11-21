export type ModelContextInfo = {
  maxContextTokens: number;
  defaultHistoryRatio?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_HISTORY_RATIO = 0.5;

const MODEL_CONTEXT_TABLE: Record<string, ModelContextInfo> = Object.freeze({
  "openai/gpt-4o": { maxContextTokens: 128_000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4o-mini": { maxContextTokens: 128_000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4.1": { maxContextTokens: 128_000, defaultHistoryRatio: 0.5 },
  "openai/gpt-4.1-mini": {
    maxContextTokens: 128_000,
    defaultHistoryRatio: 0.5,
  },
  "openai/gpt-4.1-nano": { maxContextTokens: 64_000, defaultHistoryRatio: 0.5 },
  "openai/o4-mini": { maxContextTokens: 128_000, defaultHistoryRatio: 0.5 },
  "anthropic/claude-3-5-sonnet": {
    maxContextTokens: 200_000,
    defaultHistoryRatio: 0.5,
  },
  "anthropic/claude-3-5-haiku": {
    maxContextTokens: 200_000,
    defaultHistoryRatio: 0.5,
  },
});

let envOverridesCache: Record<string, ModelContextInfo> | null = null;

function normalizeKey(modelId: string): string {
  return modelId?.toLowerCase() ?? "";
}

function loadEnvOverrides(): Record<string, ModelContextInfo> {
  if (envOverridesCache) {
    return envOverridesCache;
  }

  const raw = process.env.HISTORY_MODEL_CONTEXT;
  if (!raw) {
    envOverridesCache = {};
    return envOverridesCache;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const overrides: Record<string, ModelContextInfo> = {};
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
          (value as { maxContextTokens?: unknown }).maxContextTokens
        );
        if (!Number.isFinite(maxContextTokens)) {
          continue;
        }
        const ratioRaw = (value as { defaultHistoryRatio?: unknown })
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

export function resetModelContextOverrides(): void {
  envOverridesCache = null;
}

export function getModelContextInfo(modelId: string): ModelContextInfo {
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
