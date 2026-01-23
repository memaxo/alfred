/**
 * Model Context Info (Backward Compatibility Layer)
 *
 * This module provides backward compatibility with the legacy API.
 * For new code, prefer using the registry directly:
 *
 * @example
 * import { getModelSpec, calculateBudget } from "@alfred/history";
 *
 * const spec = getModelSpec("openai/gpt-4o");
 * const budget = calculateBudget({ modelId: "openai/gpt-4o" });
 */

import { getModelSpec, MODEL_REGISTRY, resolveModelId } from "./registry";

export type ModelContextInfo = {
  maxContextTokens: number;
  defaultHistoryRatio?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_HISTORY_RATIO = 0.55; // Updated from research

// Build legacy table from registry for backward compatibility
const MODEL_CONTEXT_TABLE: Record<string, ModelContextInfo> = Object.freeze(
  Object.fromEntries(
    Object.entries(MODEL_REGISTRY).map(([id, spec]) => [
      id,
      {
        maxContextTokens: spec.capabilities.maxContextTokens,
        defaultHistoryRatio: spec.recommendedHistoryRatio,
      },
    ])
  )
);

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

  // Priority 1: Environment variable overrides
  if (override) {
    return {
      maxContextTokens: override.maxContextTokens,
      defaultHistoryRatio:
        typeof override.defaultHistoryRatio === "number"
          ? override.defaultHistoryRatio
          : DEFAULT_HISTORY_RATIO,
    };
  }

  // Priority 2: Registry lookup (with alias resolution)
  const canonicalId = resolveModelId(key);
  const spec = getModelSpec(canonicalId);
  if (spec) {
    return {
      maxContextTokens: spec.capabilities.maxContextTokens,
      defaultHistoryRatio: spec.recommendedHistoryRatio,
    };
  }

  // Priority 3: Legacy table lookup
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

  // Fallback: Default values
  return {
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    defaultHistoryRatio: DEFAULT_HISTORY_RATIO,
  };
}
