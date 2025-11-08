/**
 * Provider configuration system for RAG operations
 * Supports multiple providers with fallback logic
 */

import { openai } from "@ai-sdk/openai";
import type { EmbeddingModel } from "ai";
import { embed as embedText } from "ai";

export type EmbeddingProvider = "openai" | "bedrock" | "together";

export type RerankingProvider = "cohere" | "bedrock" | "together";

export interface EmbeddingProviderConfig {
  name: EmbeddingProvider;
  model: EmbeddingModel<string>;
}

export interface RerankingProviderConfig {
  name: RerankingProvider;
  model?: unknown; // Will be RerankingModel when Cohere provider supports it
}

const FALLBACK_PROVIDERS: EmbeddingProvider[] = ["openai"];

/**
 * Gets the configured embedding provider
 */
export function getEmbeddingProvider(): EmbeddingProviderConfig {
  const provider = (process.env.EMBEDDING_PROVIDER ??
    "openai") as EmbeddingProvider;

  switch (provider) {
    case "openai":
      return {
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      };
    default:
      return {
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      };
  }
}

/**
 * Gets the configured reranking provider
 */
export function getRerankingProvider(): RerankingProviderConfig {
  const provider = (process.env.RERANKING_PROVIDER ??
    "cohere") as RerankingProvider;

  switch (provider) {
    case "cohere":
      return {
        name: "cohere",
      };
    default:
      return {
        name: "cohere",
      };
  }
}

/**
 * Health check for embedding provider
 */
export async function checkEmbedHealth(
  config: EmbeddingProviderConfig
): Promise<boolean> {
  try {
    const { embedding } = await embedText({
      model: config.model,
      value: "health check",
    });
    return Array.isArray(embedding) && embedding.length > 0;
  } catch {
    return false;
  }
}

/**
 * Health check for reranking provider
 */
export async function checkRerankHealth(
  config: RerankingProviderConfig
): Promise<boolean> {
  // For now, just check if API key is present
  // Will be enhanced when Cohere provider supports reranking models
  if (config.name === "cohere") {
    return (
      typeof process.env.COHERE_API_KEY === "string" &&
      process.env.COHERE_API_KEY.length > 0
    );
  }
  return false;
}

/**
 * Gets embedding provider with fallback logic
 */
export async function getEmbedWithFallback(): Promise<EmbeddingProviderConfig> {
  const primary = getEmbeddingProvider();
  const isHealthy = await checkEmbedHealth(primary);

  if (isHealthy) {
    return primary;
  }

  // Try fallback providers
  for (const fallbackName of FALLBACK_PROVIDERS) {
    if (fallbackName === primary.name) {
      continue; // Skip if already tried
    }
    const fallback: EmbeddingProviderConfig = {
      name: fallbackName,
      model: openai.textEmbeddingModel("text-embedding-3-small"),
    };
    const fallbackHealthy = await checkEmbedHealth(fallback);
    if (fallbackHealthy) {
      return fallback;
    }
  }

  // If all fail, return primary anyway (will throw error downstream)
  return primary;
}
