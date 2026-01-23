import type { ModelProvider } from "@alfred/type/model";

/**
 * Pricing Registry
 *
 * Cost per 1M tokens for known models.
 * Prices are in USD and should be updated periodically.
 *
 * Last updated: January 2025
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Google: https://ai.google.dev/pricing
 * - DeepSeek: https://platform.deepseek.com/api-docs/pricing
 * - Mistral: https://mistral.ai/technology/#pricing
 * - Cerebras: https://cerebras.ai/pricing
 * - xAI: https://x.ai/api
 */

export type ModelPricing = {
  promptCostPer1M: number;
  completionCostPer1M: number;
  cachedPromptPer1M?: number;
  reasoningPer1M?: number;
};

type PricingRegistry = Record<string, ModelPricing>;

// OpenAI pricing (January 2025)
const openaiPricing: PricingRegistry = {
  // GPT-5 family
  "gpt-5.2": { promptCostPer1M: 1.75, completionCostPer1M: 14.0, cachedPromptPer1M: 0.175 },
  // GPT-4o family
  "gpt-4o": { promptCostPer1M: 2.5, completionCostPer1M: 10.0, cachedPromptPer1M: 1.25 },
  "gpt-4o-mini": { promptCostPer1M: 0.15, completionCostPer1M: 0.6, cachedPromptPer1M: 0.075 },
  // GPT-4.1 family
  "gpt-4.1": { promptCostPer1M: 2.0, completionCostPer1M: 8.0, cachedPromptPer1M: 0.5 },
  "gpt-4.1-mini": { promptCostPer1M: 0.4, completionCostPer1M: 1.6, cachedPromptPer1M: 0.1 },
  "gpt-4.1-nano": { promptCostPer1M: 0.1, completionCostPer1M: 0.4, cachedPromptPer1M: 0.025 },
  // o-series (reasoning)
  o1: { promptCostPer1M: 15.0, completionCostPer1M: 60.0, reasoningPer1M: 60.0 },
  "o1-mini": { promptCostPer1M: 1.1, completionCostPer1M: 4.4, reasoningPer1M: 4.4 },
  o3: { promptCostPer1M: 10.0, completionCostPer1M: 40.0, reasoningPer1M: 40.0 },
  "o3-mini": { promptCostPer1M: 1.1, completionCostPer1M: 4.4, reasoningPer1M: 4.4 },
  "o4-mini": { promptCostPer1M: 1.1, completionCostPer1M: 4.4, reasoningPer1M: 4.4 },
  // Legacy
  "gpt-4-turbo": { promptCostPer1M: 10.0, completionCostPer1M: 30.0 },
  "gpt-4": { promptCostPer1M: 30.0, completionCostPer1M: 60.0 },
  "gpt-3.5-turbo": { promptCostPer1M: 0.5, completionCostPer1M: 1.5 },
};

// Anthropic pricing (January 2025)
const anthropicPricing: PricingRegistry = {
  // Claude 4.5 family
  "claude-opus-4.5": { promptCostPer1M: 5.0, completionCostPer1M: 25.0, cachedPromptPer1M: 0.5 },
  "claude-sonnet-4.5": { promptCostPer1M: 3.0, completionCostPer1M: 15.0, cachedPromptPer1M: 0.3 },
  // Claude 4 family
  "claude-opus-4": { promptCostPer1M: 15.0, completionCostPer1M: 75.0, cachedPromptPer1M: 1.5 },
  "claude-sonnet-4": { promptCostPer1M: 3.0, completionCostPer1M: 15.0, cachedPromptPer1M: 0.3 },
  // Claude 3.5 family
  "claude-3-5-sonnet": { promptCostPer1M: 3.0, completionCostPer1M: 15.0, cachedPromptPer1M: 0.3 },
  "claude-3.5-sonnet": { promptCostPer1M: 3.0, completionCostPer1M: 15.0, cachedPromptPer1M: 0.3 },
  "claude-3-5-haiku": { promptCostPer1M: 0.8, completionCostPer1M: 4.0, cachedPromptPer1M: 0.08 },
  "claude-3.5-haiku": { promptCostPer1M: 0.8, completionCostPer1M: 4.0, cachedPromptPer1M: 0.08 },
  // Claude 3 family
  "claude-3-opus": { promptCostPer1M: 15.0, completionCostPer1M: 75.0 },
  "claude-3-sonnet": { promptCostPer1M: 3.0, completionCostPer1M: 15.0 },
  "claude-3-haiku": { promptCostPer1M: 0.25, completionCostPer1M: 1.25 },
};

// Google pricing (January 2025)
const googlePricing: PricingRegistry = {
  // Gemini 2.5 family
  "gemini-2.5-pro": { promptCostPer1M: 1.25, completionCostPer1M: 10.0, cachedPromptPer1M: 0.125 },
  "gemini-2.5-flash": { promptCostPer1M: 0.15, completionCostPer1M: 0.6, cachedPromptPer1M: 0.0375 },
  // Gemini 2.0 family
  "gemini-2.0-pro": { promptCostPer1M: 0.1, completionCostPer1M: 0.4 },
  "gemini-2.0-flash": { promptCostPer1M: 0.0, completionCostPer1M: 0.0 }, // Free experimental
  // Gemini 1.5 family
  "gemini-1.5-pro": { promptCostPer1M: 1.25, completionCostPer1M: 5.0, cachedPromptPer1M: 0.3125 },
  "gemini-1.5-flash": { promptCostPer1M: 0.075, completionCostPer1M: 0.3 },
  "gemini-pro-1.5": { promptCostPer1M: 1.25, completionCostPer1M: 5.0 },
};

// DeepSeek pricing (January 2025) - Ultra low cost
const deepseekPricing: PricingRegistry = {
  "deepseek-v3": { promptCostPer1M: 0.27, completionCostPer1M: 1.1, cachedPromptPer1M: 0.07 },
  "deepseek-chat": { promptCostPer1M: 0.27, completionCostPer1M: 1.1, cachedPromptPer1M: 0.07 },
  "deepseek-r1": { promptCostPer1M: 0.55, completionCostPer1M: 2.19, reasoningPer1M: 2.19 },
  "deepseek-reasoner": { promptCostPer1M: 0.55, completionCostPer1M: 2.19, reasoningPer1M: 2.19 },
};

// Mistral pricing (January 2025)
const mistralPricing: PricingRegistry = {
  "mistral-large": { promptCostPer1M: 2.0, completionCostPer1M: 6.0 },
  "mistral-small": { promptCostPer1M: 0.2, completionCostPer1M: 0.6 },
  codestral: { promptCostPer1M: 0.3, completionCostPer1M: 0.9 },
  "mistral-nemo": { promptCostPer1M: 0.15, completionCostPer1M: 0.15 },
};

// xAI Grok pricing (January 2025)
const xaiPricing: PricingRegistry = {
  "grok-3": { promptCostPer1M: 3.0, completionCostPer1M: 15.0 },
  "grok-4": { promptCostPer1M: 5.0, completionCostPer1M: 25.0 },
};

// Cerebras pricing (January 2025) - Ultra fast inference
const cerebrasPricing: PricingRegistry = {
  "llama3.1-8b": { promptCostPer1M: 0.1, completionCostPer1M: 0.1 },
  "llama3.1-70b": { promptCostPer1M: 0.6, completionCostPer1M: 0.6 },
  "llama-4-70b": { promptCostPer1M: 0.6, completionCostPer1M: 0.6 },
  "llama-4-scout": { promptCostPer1M: 0.2, completionCostPer1M: 0.6 },
  "llama-4-maverick": { promptCostPer1M: 0.5, completionCostPer1M: 1.5 },
  "gpt-oss-120b": { promptCostPer1M: 0.35, completionCostPer1M: 1.4 },
  "gpt-oss-20b": { promptCostPer1M: 0.1, completionCostPer1M: 0.4 },
};

// OpenRouter pricing - aggregates multiple providers
const openrouterPricing: PricingRegistry = {
  ...Object.fromEntries(
    Object.entries(anthropicPricing).map(([k, v]) => [`anthropic/${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(googlePricing).map(([k, v]) => [`google/${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(openaiPricing).map(([k, v]) => [`openai/${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(deepseekPricing).map(([k, v]) => [`deepseek/${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(mistralPricing).map(([k, v]) => [`mistral/${k}`, v])
  ),
};

// Default fallback pricing for unknown models
const defaultPricing: ModelPricing = {
  promptCostPer1M: 1.0,
  completionCostPer1M: 3.0,
};

/**
 * Get the appropriate pricing registry for a provider.
 */
function getRegistryForProvider(provider: ModelProvider): PricingRegistry {
  switch (provider) {
    case "openai":
      return openaiPricing;
    case "anthropic":
      return anthropicPricing;
    case "google":
      return googlePricing;
    case "deepseek":
      return deepseekPricing;
    case "mistral":
      return mistralPricing;
    case "xai":
      return xaiPricing;
    case "cerebras":
      return cerebrasPricing;
    case "openrouter":
      return openrouterPricing;
    default:
      return {};
  }
}

/**
 * Get pricing for a specific model.
 */
export function getModelPricing(
  provider: ModelProvider,
  modelId: string
): ModelPricing {
  const registry = getRegistryForProvider(provider);

  // Normalize model ID (remove provider prefix if present)
  const normalizedId = modelId.includes("/")
    ? modelId.split("/").pop() ?? modelId
    : modelId;

  // Try exact match with original ID
  const exactMatch = registry[modelId];
  if (exactMatch) {
    return exactMatch;
  }

  // Try exact match with normalized ID
  const normalizedMatch = registry[normalizedId];
  if (normalizedMatch) {
    return normalizedMatch;
  }

  // Try prefix match (e.g., "gpt-4o-2024-08-06" matches "gpt-4o")
  const prefixMatch = Object.keys(registry).find(
    (key) => modelId.startsWith(key) || normalizedId.startsWith(key)
  );
  if (prefixMatch) {
    const match = registry[prefixMatch];
    if (match) {
      return match;
    }
  }

  // Try OpenRouter registry as fallback (has provider-prefixed entries)
  if (provider !== "openrouter") {
    const openrouterKey = `${provider}/${normalizedId}`;
    const openrouterMatch = openrouterPricing[openrouterKey];
    if (openrouterMatch) {
      return openrouterMatch;
    }
  }

  return defaultPricing;
}

/**
 * Get all available pricing entries for debugging/display.
 */
export function getAllPricing(): Record<string, ModelPricing> {
  return {
    ...Object.fromEntries(
      Object.entries(openaiPricing).map(([k, v]) => [`openai/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(anthropicPricing).map(([k, v]) => [`anthropic/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(googlePricing).map(([k, v]) => [`google/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(deepseekPricing).map(([k, v]) => [`deepseek/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(mistralPricing).map(([k, v]) => [`mistral/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(xaiPricing).map(([k, v]) => [`xai/${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(cerebrasPricing).map(([k, v]) => [`cerebras/${k}`, v])
    ),
  };
}

/**
 * Calculate cost in USD for a given token usage.
 */
export function calculateCostUsd(
  provider: ModelProvider,
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(provider, modelId);

  const promptCost = (promptTokens / 1_000_000) * pricing.promptCostPer1M;
  const completionCost =
    (completionTokens / 1_000_000) * pricing.completionCostPer1M;

  return promptCost + completionCost;
}

/**
 * Calculate cost in USD with detailed breakdown (cached, reasoning tokens).
 */
export function calculateDetailedCostUsd(
  provider: ModelProvider,
  modelId: string,
  usage: {
    promptTokens: number;
    cachedTokens?: number;
    completionTokens: number;
    reasoningTokens?: number;
  }
): {
  promptCost: number;
  cachedCost: number;
  completionCost: number;
  reasoningCost: number;
  totalCost: number;
} {
  const pricing = getModelPricing(provider, modelId);

  // Non-cached prompt tokens
  const nonCachedPrompt = Math.max(
    0,
    usage.promptTokens - (usage.cachedTokens ?? 0)
  );

  const promptCost = (nonCachedPrompt / 1_000_000) * pricing.promptCostPer1M;

  // Cached prompt tokens (discounted rate)
  const cachedRate = pricing.cachedPromptPer1M ?? pricing.promptCostPer1M;
  const cachedCost = ((usage.cachedTokens ?? 0) / 1_000_000) * cachedRate;

  // Completion tokens
  const completionCost =
    (usage.completionTokens / 1_000_000) * pricing.completionCostPer1M;

  // Reasoning tokens (for o1/R1 models)
  const reasoningRate = pricing.reasoningPer1M ?? pricing.completionCostPer1M;
  const reasoningCost = ((usage.reasoningTokens ?? 0) / 1_000_000) * reasoningRate;

  return {
    promptCost,
    cachedCost,
    completionCost,
    reasoningCost,
    totalCost: promptCost + cachedCost + completionCost + reasoningCost,
  };
}

/**
 * Estimate cost for a projected usage.
 */
export function estimateCostUsd(
  provider: ModelProvider,
  modelId: string,
  estimatedPromptTokens: number,
  estimatedCompletionTokens: number,
  cacheHitRatio = 0
): {
  minCost: number;
  maxCost: number;
  expectedCost: number;
} {
  const pricing = getModelPricing(provider, modelId);

  // Maximum cost (no caching)
  const maxCost =
    (estimatedPromptTokens / 1_000_000) * pricing.promptCostPer1M +
    (estimatedCompletionTokens / 1_000_000) * pricing.completionCostPer1M;

  // Minimum cost (maximum caching)
  const cachedRate = pricing.cachedPromptPer1M ?? pricing.promptCostPer1M;
  const minCost =
    (estimatedPromptTokens / 1_000_000) * cachedRate +
    (estimatedCompletionTokens / 1_000_000) * pricing.completionCostPer1M;

  // Expected cost (based on cache hit ratio)
  const cachedTokens = estimatedPromptTokens * cacheHitRatio;
  const nonCachedTokens = estimatedPromptTokens * (1 - cacheHitRatio);
  const expectedCost =
    (nonCachedTokens / 1_000_000) * pricing.promptCostPer1M +
    (cachedTokens / 1_000_000) * cachedRate +
    (estimatedCompletionTokens / 1_000_000) * pricing.completionCostPer1M;

  return { minCost, maxCost, expectedCost };
}
