import type { ModelProvider } from "@alfred/type/model";

/**
 * Pricing Registry
 *
 * Cost per 1M tokens for known models.
 * Prices are in USD and should be updated periodically.
 *
 * Sources:
 * - OpenAI: https://openai.com/api/pricing/
 * - Cerebras: https://cerebras.ai/pricing
 * - OpenRouter: https://openrouter.ai/models (varies by model)
 */

export type ModelPricing = {
  promptCostPer1M: number;
  completionCostPer1M: number;
};

type PricingRegistry = Record<string, ModelPricing>;

// Provider-level pricing registries
const openaiPricing: PricingRegistry = {
  "gpt-4o": { promptCostPer1M: 2.5, completionCostPer1M: 10.0 },
  "gpt-4o-mini": { promptCostPer1M: 0.15, completionCostPer1M: 0.6 },
  "gpt-4-turbo": { promptCostPer1M: 10.0, completionCostPer1M: 30.0 },
  "gpt-4": { promptCostPer1M: 30.0, completionCostPer1M: 60.0 },
  "gpt-3.5-turbo": { promptCostPer1M: 0.5, completionCostPer1M: 1.5 },
};

const cerebrasPricing: PricingRegistry = {
  "llama3.1-8b": { promptCostPer1M: 0.1, completionCostPer1M: 0.1 },
  "llama3.1-70b": { promptCostPer1M: 0.6, completionCostPer1M: 0.6 },
  "llama-4-70b": { promptCostPer1M: 0.6, completionCostPer1M: 0.6 },
};

// OpenRouter pricing varies by model - these are representative samples
const openrouterPricing: PricingRegistry = {
  "anthropic/claude-3.5-sonnet": {
    promptCostPer1M: 3.0,
    completionCostPer1M: 15.0,
  },
  "anthropic/claude-3-opus": {
    promptCostPer1M: 15.0,
    completionCostPer1M: 75.0,
  },
  "anthropic/claude-3-sonnet": {
    promptCostPer1M: 3.0,
    completionCostPer1M: 15.0,
  },
  "anthropic/claude-3-haiku": {
    promptCostPer1M: 0.25,
    completionCostPer1M: 1.25,
  },
  "google/gemini-pro-1.5": { promptCostPer1M: 2.5, completionCostPer1M: 10.0 },
  "openai/gpt-4o": { promptCostPer1M: 2.5, completionCostPer1M: 10.0 },
  "openai/gpt-4o-mini": { promptCostPer1M: 0.15, completionCostPer1M: 0.6 },
};

// Default fallback pricing for unknown models
const defaultPricing: ModelPricing = {
  promptCostPer1M: 1.0,
  completionCostPer1M: 3.0,
};

/**
 * Get pricing for a specific model.
 */
export function getModelPricing(
  provider: ModelProvider,
  modelId: string
): ModelPricing {
  let registry: PricingRegistry;

  switch (provider) {
    case "openai":
    case "anthropic":
    case "google":
      registry = openaiPricing;
      break;
    case "cerebras":
      registry = cerebrasPricing;
      break;
    case "openrouter":
      registry = openrouterPricing;
      break;
    default:
      return defaultPricing;
  }

  // Try exact match
  const exactMatch = registry[modelId];
  if (exactMatch) {
    return exactMatch;
  }

  // Try prefix match (e.g., "gpt-4o-2024-08-06" matches "gpt-4o")
  const prefixMatch = Object.keys(registry).find((key) =>
    modelId.startsWith(key)
  );
  if (prefixMatch) {
    const match = registry[prefixMatch];
    if (match) {
      return match;
    }
  }

  return defaultPricing;
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
