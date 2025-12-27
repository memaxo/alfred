/**
 * ALFRED Model Cost Registry
 * Pricing information for LLM providers
 */

/**
 * Cost per 1M tokens in cents
 */
export type ModelCost = {
  input: number; // cents per 1M input tokens
  output: number; // cents per 1M output tokens
  cached?: number; // cents per 1M cached input tokens (if supported)
};

/**
 * Model cost registry
 * Costs are in cents per 1M tokens
 *
 * Sources:
 * - Cerebras: https://cerebras.ai/pricing
 * - OpenRouter: https://openrouter.ai/docs#models
 */
export const MODEL_COSTS: Record<string, ModelCost> = {
  // ============================================================================
  // Cerebras Models (fast inference, competitive pricing)
  // ============================================================================
  "cerebras:llama3.1-8b": { input: 10, output: 10 },
  "cerebras:llama3.1-70b": { input: 60, output: 60 },
  "cerebras:llama-3.3-70b": { input: 60, output: 60 },

  // ============================================================================
  // OpenRouter - Anthropic
  // ============================================================================
  "openrouter:anthropic/claude-3.5-sonnet": {
    input: 300,
    output: 1500,
    cached: 30,
  },
  "openrouter:anthropic/claude-3.5-sonnet-20241022": {
    input: 300,
    output: 1500,
    cached: 30,
  },
  "openrouter:anthropic/claude-3-opus": {
    input: 1500,
    output: 7500,
    cached: 150,
  },
  "openrouter:anthropic/claude-3-haiku": { input: 25, output: 125, cached: 3 },

  // ============================================================================
  // OpenRouter - OpenAI
  // ============================================================================
  "openrouter:openai/gpt-4o": { input: 250, output: 1000 },
  "openrouter:openai/gpt-4o-mini": { input: 15, output: 60 },
  "openrouter:openai/gpt-4-turbo": { input: 1000, output: 3000 },
  "openrouter:openai/o1": { input: 1500, output: 6000 },
  "openrouter:openai/o1-mini": { input: 300, output: 1200 },

  // ============================================================================
  // OpenRouter - Google
  // ============================================================================
  "openrouter:google/gemini-flash-1.5": { input: 7.5, output: 30 },
  "openrouter:google/gemini-pro-1.5": { input: 125, output: 500 },
  "openrouter:google/gemini-2.0-flash-exp": { input: 0, output: 0 }, // Free tier

  // ============================================================================
  // OpenRouter - Meta
  // ============================================================================
  "openrouter:meta-llama/llama-3.1-405b-instruct": { input: 270, output: 270 },
  "openrouter:meta-llama/llama-3.1-70b-instruct": { input: 52, output: 52 },
  "openrouter:meta-llama/llama-3.1-8b-instruct": { input: 6, output: 6 },
  "openrouter:meta-llama/llama-3.3-70b-instruct": { input: 12, output: 12 },

  // ============================================================================
  // OpenRouter - Mistral
  // ============================================================================
  "openrouter:mistralai/mistral-large": { input: 200, output: 600 },
  "openrouter:mistralai/mistral-small": { input: 10, output: 30 },
  "openrouter:mistralai/codestral-latest": { input: 30, output: 90 },

  // ============================================================================
  // OpenRouter - DeepSeek
  // ============================================================================
  "openrouter:deepseek/deepseek-chat": { input: 14, output: 28 },
  "openrouter:deepseek/deepseek-coder": { input: 14, output: 28 },
};

/**
 * Default cost for unknown models (conservative estimate)
 */
export const DEFAULT_MODEL_COST: ModelCost = {
  input: 100,
  output: 300,
};

/**
 * Get cost for a model
 */
export function getModelCost(modelRef: string): ModelCost {
  return MODEL_COSTS[modelRef] ?? DEFAULT_MODEL_COST;
}

/**
 * Calculate cost in cents for a request
 */
export function calculateCost(
  modelRef: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0
): number {
  const cost = getModelCost(modelRef);

  // Calculate cost in cents (costs are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * cost.input;
  const outputCost = (outputTokens / 1_000_000) * cost.output;
  const cachedCost = cost.cached ? (cachedTokens / 1_000_000) * cost.cached : 0;

  // Return total cost in cents, rounded up
  return Math.ceil(inputCost + outputCost + cachedCost);
}

/**
 * Estimate cost for a request (before execution)
 */
export function estimateCost(
  modelRef: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  return calculateCost(
    modelRef,
    estimatedInputTokens,
    estimatedOutputTokens,
    0
  );
}

/**
 * Get cost per 1k tokens for display
 */
export function getCostPer1k(modelRef: string): {
  input: number;
  output: number;
} {
  const cost = getModelCost(modelRef);
  return {
    input: cost.input / 1000, // Convert from per-1M to per-1k
    output: cost.output / 1000,
  };
}

/**
 * Compare models by cost (returns cheaper model first)
 */
export function compareModelsByCost(modelA: string, modelB: string): number {
  const costA = getModelCost(modelA);
  const costB = getModelCost(modelB);

  // Use average of input + output cost for comparison
  const avgA = (costA.input + costA.output) / 2;
  const avgB = (costB.input + costB.output) / 2;

  return avgA - avgB;
}

/**
 * Get cheaper alternative models for a given model
 */
export function getCheaperAlternatives(
  modelRef: string,
  maxCostRatio = 0.5
): string[] {
  const baseCost = getModelCost(modelRef);
  const baseAvg = (baseCost.input + baseCost.output) / 2;

  return Object.entries(MODEL_COSTS)
    .filter(([ref, cost]) => {
      if (ref === modelRef) {
        return false;
      }
      const avg = (cost.input + cost.output) / 2;
      return avg <= baseAvg * maxCostRatio;
    })
    .sort((a, b) => {
      const avgA = (a[1].input + a[1].output) / 2;
      const avgB = (b[1].input + b[1].output) / 2;
      return avgB - avgA; // Sort by quality (higher cost = potentially better)
    })
    .map(([ref]) => ref);
}
