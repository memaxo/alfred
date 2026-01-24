/**
 * Model Registry with Context Windows and Pricing
 *
 * Research-verified context windows and pricing as of January 2025.
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Google: https://ai.google.dev/pricing
 * - DeepSeek: https://platform.deepseek.com/api-docs/pricing
 * - Mistral: https://mistral.ai/technology/#pricing
 * - xAI: https://x.ai/api
 *
 * @module @alfred/history/registry
 */

export interface ModelCapabilities {
  /** Maximum input context window in tokens */
  maxContextTokens: number;
  /** Maximum output tokens per response */
  maxOutputTokens: number;
  /** Supports tool/function calling */
  toolCalling: boolean;
  /** Supports structured output (JSON mode) */
  structuredOutput: boolean;
  /** Supports vision/images */
  vision: boolean;
  /** Extended context available (beta) */
  extendedContext?: number;
}

export interface ModelPricingTier {
  /** Cost per 1M input tokens (USD) */
  inputPer1M: number;
  /** Cost per 1M cached input tokens (USD) */
  cachedInputPer1M?: number;
  /** Cost per 1M output tokens (USD) */
  outputPer1M: number;
  /** Cost per 1M reasoning tokens (for o1/R1 models) */
  reasoningPer1M?: number;
}

export interface ModelSpec {
  id: string;
  provider: ModelProvider;
  family: string;
  displayName: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricingTier;
  /** Recommended history ratio based on lost-in-middle research */
  recommendedHistoryRatio: number;
  /** Release date for versioning */
  releaseDate?: string;
  /** Whether model is deprecated */
  deprecated?: boolean;
}

import { type ModelProvider } from "@alfred/type/model";

// Re-export ModelProvider from @alfred/type for convenience
export type { ModelProvider };

// ============================================================================
// Model Registry - Research-Verified January 2025
// ============================================================================

export const MODEL_REGISTRY: Record<string, ModelSpec> = Object.freeze({
  // ---------------------------------------------------------------------------
  // OpenAI Models
  // ---------------------------------------------------------------------------
  "openai/gpt-5.2": {
    capabilities: {
      maxContextTokens: 256_000,
      maxOutputTokens: 32_768,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "GPT-5.2",
    family: "gpt-5",
    id: "openai/gpt-5.2",
    pricing: {
      inputPer1M: 1.75,
      cachedInputPer1M: 0.175,
      outputPer1M: 14.0,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-01",
  },
  "openai/gpt-4o": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 16_384,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "GPT-4o",
    family: "gpt-4o",
    id: "openai/gpt-4o",
    pricing: {
      inputPer1M: 2.5,
      cachedInputPer1M: 1.25,
      outputPer1M: 10.0,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-08",
  },
  "openai/gpt-4o-mini": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 16_384,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "GPT-4o Mini",
    family: "gpt-4o",
    id: "openai/gpt-4o-mini",
    pricing: {
      inputPer1M: 0.15,
      cachedInputPer1M: 0.075,
      outputPer1M: 0.6,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-07",
  },
  "openai/gpt-4.1": {
    capabilities: {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 32_768,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "GPT-4.1",
    family: "gpt-4.1",
    id: "openai/gpt-4.1",
    pricing: {
      inputPer1M: 2.0,
      cachedInputPer1M: 0.5,
      outputPer1M: 8.0,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-04",
  },
  "openai/gpt-4.1-mini": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 16_384,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "GPT-4.1 Mini",
    family: "gpt-4.1",
    id: "openai/gpt-4.1-mini",
    pricing: {
      inputPer1M: 0.4,
      cachedInputPer1M: 0.1,
      outputPer1M: 1.6,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-04",
  },
  "openai/gpt-4.1-nano": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 16_384,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "GPT-4.1 Nano",
    family: "gpt-4.1",
    id: "openai/gpt-4.1-nano",
    pricing: {
      inputPer1M: 0.1,
      cachedInputPer1M: 0.025,
      outputPer1M: 0.4,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-04",
  },
  "openai/o1": {
    id: "openai/o1",
    provider: "openai",
    family: "o1",
    displayName: "o1",
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
    },
    pricing: {
      cachedInputPer1M: 7.5,
      inputPer1M: 15.0,
      outputPer1M: 60.0,
      reasoningPer1M: 60.0,
    },
    recommendedHistoryRatio: 0.45, // Lower for reasoning models
    releaseDate: "2024-12",
  },
  "openai/o1-mini": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 65_536,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "o1 Mini",
    family: "o1",
    id: "openai/o1-mini",
    pricing: {
      inputPer1M: 1.1,
      cachedInputPer1M: 0.55,
      outputPer1M: 4.4,
      reasoningPer1M: 4.4,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.45,
    releaseDate: "2024-09",
  },
  "openai/o3": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "o3",
    family: "o3",
    id: "openai/o3",
    pricing: {
      inputPer1M: 10.0,
      cachedInputPer1M: 2.5,
      outputPer1M: 40.0,
      reasoningPer1M: 40.0,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.45,
    releaseDate: "2025-01",
  },
  "openai/o3-mini": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 65_536,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "o3 Mini",
    family: "o3",
    id: "openai/o3-mini",
    pricing: {
      inputPer1M: 1.1,
      cachedInputPer1M: 0.55,
      outputPer1M: 4.4,
      reasoningPer1M: 4.4,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.45,
    releaseDate: "2025-01",
  },
  "openai/o4-mini": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "o4 Mini",
    family: "o4",
    id: "openai/o4-mini",
    pricing: {
      inputPer1M: 1.1,
      cachedInputPer1M: 0.275,
      outputPer1M: 4.4,
      reasoningPer1M: 4.4,
    },
    provider: "openai",
    recommendedHistoryRatio: 0.45,
    releaseDate: "2025-04",
  },
  // Cerebras-hosted OpenAI compatible models
  "openai/gpt-oss-120b": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "GPT OSS 120B (Cerebras)",
    family: "gpt-oss",
    id: "openai/gpt-oss-120b",
    pricing: {
      inputPer1M: 0.35,
      outputPer1M: 1.4,
    },
    provider: "cerebras",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-01",
  },
  "openai/gpt-oss-20b": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "GPT OSS 20B (Cerebras)",
    family: "gpt-oss",
    id: "openai/gpt-oss-20b",
    pricing: {
      inputPer1M: 0.1,
      outputPer1M: 0.4,
    },
    provider: "cerebras",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-01",
  },

  // ---------------------------------------------------------------------------
  // Anthropic Models
  // ---------------------------------------------------------------------------
  "anthropic/claude-opus-4.5": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 64_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      extendedContext: 1_000_000,
    },
    displayName: "Claude Opus 4.5",
    family: "claude-4.5",
    id: "anthropic/claude-opus-4.5",
    pricing: {
      inputPer1M: 5.0,
      cachedInputPer1M: 0.5,
      outputPer1M: 25.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-12",
  },
  "anthropic/claude-opus-4": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 64_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      extendedContext: 1_000_000,
    },
    displayName: "Claude Opus 4",
    family: "claude-4",
    id: "anthropic/claude-opus-4",
    pricing: {
      inputPer1M: 15.0,
      cachedInputPer1M: 1.5,
      outputPer1M: 75.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-05",
  },
  "anthropic/claude-sonnet-4.5": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 64_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      extendedContext: 1_000_000,
    },
    displayName: "Claude Sonnet 4.5",
    family: "claude-4.5",
    id: "anthropic/claude-sonnet-4.5",
    pricing: {
      inputPer1M: 3.0,
      cachedInputPer1M: 0.3,
      outputPer1M: 15.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-10",
  },
  "anthropic/claude-sonnet-4": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 64_000,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      extendedContext: 1_000_000,
    },
    displayName: "Claude Sonnet 4",
    family: "claude-4",
    id: "anthropic/claude-sonnet-4",
    pricing: {
      inputPer1M: 3.0,
      cachedInputPer1M: 0.3,
      outputPer1M: 15.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-05",
  },
  "anthropic/claude-3-5-sonnet": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Claude 3.5 Sonnet",
    family: "claude-3.5",
    id: "anthropic/claude-3-5-sonnet",
    pricing: {
      inputPer1M: 3.0,
      cachedInputPer1M: 0.3,
      outputPer1M: 15.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-10",
  },
  "anthropic/claude-3-5-haiku": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "Claude 3.5 Haiku",
    family: "claude-3.5",
    id: "anthropic/claude-3-5-haiku",
    pricing: {
      inputPer1M: 0.8,
      cachedInputPer1M: 0.08,
      outputPer1M: 4.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-10",
  },
  "anthropic/claude-3-opus": {
    capabilities: {
      maxContextTokens: 200_000,
      maxOutputTokens: 4_096,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Claude 3 Opus",
    family: "claude-3",
    id: "anthropic/claude-3-opus",
    pricing: {
      inputPer1M: 15.0,
      cachedInputPer1M: 1.5,
      outputPer1M: 75.0,
    },
    provider: "anthropic",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-03",
  },

  // ---------------------------------------------------------------------------
  // Google Models
  // ---------------------------------------------------------------------------
  "google/gemini-2.5-pro": {
    id: "google/gemini-2.5-pro",
    provider: "google",
    family: "gemini-2.5",
    displayName: "Gemini 2.5 Pro",
    capabilities: {
      extendedContext: 2_000_000,
      maxContextTokens: 1_000_000,
      maxOutputTokens: 65_536,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
    },
    pricing: {
      inputPer1M: 1.25, // <200k
      cachedInputPer1M: 0.125,
      outputPer1M: 10,
    },
    recommendedHistoryRatio: 0.5, // Lower for very large contexts
    releaseDate: "2025-03",
  },
  "google/gemini-2.5-flash": {
    capabilities: {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 65_536,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Gemini 2.5 Flash",
    family: "gemini-2.5",
    id: "google/gemini-2.5-flash",
    pricing: {
      inputPer1M: 0.15,
      cachedInputPer1M: 0.0375,
      outputPer1M: 0.6,
    },
    provider: "google",
    recommendedHistoryRatio: 0.5,
    releaseDate: "2025-02",
  },
  "google/gemini-2.0-pro": {
    id: "google/gemini-2.0-pro",
    provider: "google",
    family: "gemini-2.0",
    displayName: "Gemini 2.0 Pro",
    capabilities: {
      maxContextTokens: 2_000_000,
      maxOutputTokens: 8_192,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
    },
    pricing: {
      inputPer1M: 0.1,
      outputPer1M: 0.4,
    },
    recommendedHistoryRatio: 0.45, // Very large context needs lower ratio
    releaseDate: "2024-12",
  },
  "google/gemini-2.0-flash": {
    capabilities: {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Gemini 2.0 Flash",
    family: "gemini-2.0",
    id: "google/gemini-2.0-flash",
    pricing: {
      inputPer1M: 0.0, // Free during experimental
      outputPer1M: 0.0,
    },
    provider: "google",
    recommendedHistoryRatio: 0.5,
    releaseDate: "2024-12",
  },
  "google/gemini-1.5-pro": {
    capabilities: {
      maxContextTokens: 2_000_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Gemini 1.5 Pro",
    family: "gemini-1.5",
    id: "google/gemini-1.5-pro",
    pricing: {
      inputPer1M: 1.25,
      cachedInputPer1M: 0.3125,
      outputPer1M: 5.0,
    },
    provider: "google",
    recommendedHistoryRatio: 0.45,
    releaseDate: "2024-05",
  },

  // ---------------------------------------------------------------------------
  // DeepSeek Models
  // ---------------------------------------------------------------------------
  "deepseek/deepseek-v3": {
    capabilities: {
      maxContextTokens: 64_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "DeepSeek V3",
    family: "deepseek-v3",
    id: "deepseek/deepseek-v3",
    pricing: {
      inputPer1M: 0.27,
      cachedInputPer1M: 0.07,
      outputPer1M: 1.1,
    },
    provider: "deepseek",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-12",
  },
  "deepseek/deepseek-r1": {
    id: "deepseek/deepseek-r1",
    provider: "deepseek",
    family: "deepseek-r1",
    displayName: "DeepSeek R1 (Reasoner)",
    capabilities: {
      maxContextTokens: 64_000,
      maxOutputTokens: 8_192,
      structuredOutput: true,
      toolCalling: true,
      vision: false,
    },
    pricing: {
      cachedInputPer1M: 0.14,
      inputPer1M: 0.55,
      outputPer1M: 2.19,
      reasoningPer1M: 2.19,
    },
    recommendedHistoryRatio: 0.45, // Reasoning model
    releaseDate: "2025-01",
  },

  // ---------------------------------------------------------------------------
  // Mistral Models
  // ---------------------------------------------------------------------------
  "mistral/mistral-large": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "Mistral Large",
    family: "mistral-large",
    id: "mistral/mistral-large",
    pricing: {
      inputPer1M: 2.0,
      outputPer1M: 6.0,
    },
    provider: "mistral",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-02",
  },
  "mistral/mistral-small": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "Mistral Small",
    family: "mistral-small",
    id: "mistral/mistral-small",
    pricing: {
      inputPer1M: 0.2,
      outputPer1M: 0.6,
    },
    provider: "mistral",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-09",
  },
  "mistral/codestral": {
    capabilities: {
      maxContextTokens: 256_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "Codestral",
    family: "codestral",
    id: "mistral/codestral",
    pricing: {
      inputPer1M: 0.3,
      outputPer1M: 0.9,
    },
    provider: "mistral",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2024-05",
  },

  // ---------------------------------------------------------------------------
  // xAI Models
  // ---------------------------------------------------------------------------
  "xai/grok-3": {
    capabilities: {
      maxContextTokens: 131_072,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Grok 3",
    family: "grok-3",
    id: "xai/grok-3",
    pricing: {
      inputPer1M: 3.0,
      outputPer1M: 15.0,
    },
    provider: "xai",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-02",
  },
  "xai/grok-4": {
    id: "xai/grok-4",
    provider: "xai",
    family: "grok-4",
    displayName: "Grok 4",
    capabilities: {
      maxContextTokens: 2_000_000,
      maxOutputTokens: 32_768,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
    },
    pricing: {
      inputPer1M: 5,
      outputPer1M: 25,
    },
    recommendedHistoryRatio: 0.45, // Very large context
    releaseDate: "2025-07",
  },

  // ---------------------------------------------------------------------------
  // Cerebras Models (Direct)
  // ---------------------------------------------------------------------------
  "cerebras/llama-4-scout": {
    capabilities: {
      maxContextTokens: 128_000,
      maxOutputTokens: 8_192,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
    },
    displayName: "Llama 4 Scout (Cerebras)",
    family: "llama-4",
    id: "cerebras/llama-4-scout",
    pricing: {
      inputPer1M: 0.2,
      outputPer1M: 0.6,
    },
    provider: "cerebras",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-04",
  },
  "cerebras/llama-4-maverick": {
    capabilities: {
      maxContextTokens: 256_000,
      maxOutputTokens: 16_384,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
    },
    displayName: "Llama 4 Maverick (Cerebras)",
    family: "llama-4",
    id: "cerebras/llama-4-maverick",
    pricing: {
      inputPer1M: 0.5,
      outputPer1M: 1.5,
    },
    provider: "cerebras",
    recommendedHistoryRatio: 0.55,
    releaseDate: "2025-04",
  },
});

// ============================================================================
// Model Aliases for backward compatibility and common names
// ============================================================================

export const MODEL_ALIASES: Record<string, string> = Object.freeze({
  // OpenAI aliases
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4.1": "openai/gpt-4.1",
  "gpt-4.1-mini": "openai/gpt-4.1-mini",
  "gpt-4.1-nano": "openai/gpt-4.1-nano",
  "gpt-5.2": "openai/gpt-5.2",
  o1: "openai/o1",
  "o1-mini": "openai/o1-mini",
  o3: "openai/o3",
  "o3-mini": "openai/o3-mini",
  "o4-mini": "openai/o4-mini",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b",

  // Anthropic aliases
  "claude-opus-4.5": "anthropic/claude-opus-4.5",
  "claude-opus-4": "anthropic/claude-opus-4",
  "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet",
  "claude-3.5-sonnet": "anthropic/claude-3-5-sonnet",
  "claude-3-5-haiku": "anthropic/claude-3-5-haiku",
  "claude-3.5-haiku": "anthropic/claude-3-5-haiku",
  "claude-3-opus": "anthropic/claude-3-opus",

  // Google aliases
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.0-pro": "google/gemini-2.0-pro",
  "gemini-2.0-flash": "google/gemini-2.0-flash",
  "gemini-1.5-pro": "google/gemini-1.5-pro",

  // DeepSeek aliases
  "deepseek-v3": "deepseek/deepseek-v3",
  "deepseek-chat": "deepseek/deepseek-v3",
  "deepseek-r1": "deepseek/deepseek-r1",
  "deepseek-reasoner": "deepseek/deepseek-r1",

  // Mistral aliases
  "mistral-large": "mistral/mistral-large",
  "mistral-small": "mistral/mistral-small",
  codestral: "mistral/codestral",

  // xAI aliases
  "grok-3": "xai/grok-3",
  "grok-4": "xai/grok-4",
});

// ============================================================================
// Registry Access Functions
// ============================================================================

/**
 * Resolve model ID through aliases and return canonical ID.
 */
export function resolveModelId(modelId: string): string {
  const normalized = modelId.toLowerCase().trim();
  return MODEL_ALIASES[normalized] ?? normalized;
}

/**
 * Get model spec by ID (with alias resolution).
 */
export function getModelSpec(modelId: string): ModelSpec | null {
  const canonicalId = resolveModelId(modelId);
  return MODEL_REGISTRY[canonicalId] ?? null;
}

/**
 * Get model spec or throw if not found.
 */
export function requireModelSpec(modelId: string): ModelSpec {
  const spec = getModelSpec(modelId);
  if (!spec) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return spec;
}

/**
 * List all registered models.
 */
export function listModels(): ModelSpec[] {
  return Object.values(MODEL_REGISTRY);
}

/**
 * List models by provider.
 */
export function listModelsByProvider(provider: ModelProvider): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Get all available model IDs (including aliases).
 */
export function listModelIds(): string[] {
  return [
    ...Object.keys(MODEL_REGISTRY),
    ...Object.keys(MODEL_ALIASES),
  ].toSorted();
}

// ============================================================================
// Default Fallback Spec
// ============================================================================

export const DEFAULT_MODEL_SPEC: ModelSpec = Object.freeze({
  capabilities: {
    maxContextTokens: 128_000,
    maxOutputTokens: 8_192,
    toolCalling: true,
    structuredOutput: true,
    vision: false,
  },
  displayName: "Unknown Model",
  family: "unknown",
  id: "unknown",
  pricing: {
    inputPer1M: 1.0,
    outputPer1M: 3.0,
  },
  provider: "openai",
  recommendedHistoryRatio: 0.55,
});
