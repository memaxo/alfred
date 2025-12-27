/**
 * ALFRED Model Selector
 * Budget-aware model selection with Cerebras and OpenRouter support
 */

import { logger } from "@alfred/logger";
import type { LanguageModel } from "ai";
import {
  type BudgetCheckResult,
  getBudgetManager,
  type ModelRole,
} from "./budget";

// ============================================================================
// Types
// ============================================================================

export type ModelProvider = "cerebras" | "openrouter" | "openai" | "gateway";

export interface ModelRef {
  provider: ModelProvider;
  id: string;
  mode?: "chat" | "completion";
}

export type ModelRefString = string; // Format: "provider:modelId"

export interface ModelSelection {
  model: LanguageModel;
  modelKey: string;
  provider: ModelProvider;
  estimatedLatencyMs: number;
  estimatedCostPer1k: { input: number; output: number };
}

export interface ModelSelectionOptions {
  userId?: string;
  budgetCheck?: boolean;
  maxLatencyMs?: number;
  fallbackOnBudgetExceeded?: boolean;
}

// Re-export ModelRole from budget
export type { ModelRole } from "./budget";

// ============================================================================
// Provider Instances (cached)
// ============================================================================

let cerebrasProvider: any = null;
let openrouterProvider: any = null;
let gatewayProvider: any = null;

async function getCerebrasProvider() {
  if (cerebrasProvider) return cerebrasProvider;

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    throw new Error("cerebras_api_key_missing");
  }

  try {
    const { createCerebras } = await import("@ai-sdk/cerebras");
    cerebrasProvider = createCerebras({ apiKey });
    return cerebrasProvider;
  } catch (error) {
    logger.error("cerebras_provider_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("cerebras_provider_unavailable");
  }
}

async function getOpenRouterProvider() {
  if (openrouterProvider) return openrouterProvider;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("openrouter_api_key_missing");
  }

  try {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    openrouterProvider = createOpenRouter({ apiKey });
    return openrouterProvider;
  } catch (error) {
    logger.error("openrouter_provider_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("openrouter_provider_unavailable");
  }
}

async function getGatewayProvider() {
  if (gatewayProvider) return gatewayProvider;

  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("gateway_api_key_missing");
  }

  try {
    const { createGatewayProvider } = await import("@ai-sdk/gateway");
    const baseURL =
      process.env.AI_GATEWAY_BASE_URL ?? process.env.OPENAI_BASE_URL;
    gatewayProvider = createGatewayProvider({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
    return gatewayProvider;
  } catch (error) {
    logger.error("gateway_provider_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("gateway_provider_unavailable");
  }
}

// ============================================================================
// Model Reference Parsing
// ============================================================================

/**
 * Parse a model reference string into its components
 * Format: "provider:modelId" or just "modelId" (defaults to gateway)
 */
export function parseModelRef(ref: string): ModelRef {
  const colonIndex = ref.indexOf(":");
  if (colonIndex === -1) {
    // Legacy format - assume gateway/openai
    return { provider: "gateway", id: ref };
  }

  const provider = ref.slice(0, colonIndex) as ModelProvider;
  const id = ref.slice(colonIndex + 1);

  // Validate provider
  if (!["cerebras", "openrouter", "openai", "gateway"].includes(provider)) {
    throw new Error(`unknown_model_provider:${provider}`);
  }

  return { provider, id };
}

/**
 * Format a model reference as a string
 */
export function formatModelRef(ref: ModelRef): ModelRefString {
  return `${ref.provider}:${ref.id}`;
}

// ============================================================================
// Default Models by Role
// ============================================================================

const DEFAULT_MODELS: Record<ModelRole, ModelRefString> = {
  chat: "gateway:openai/gpt-4o-mini",
  orchestrator: "gateway:openai/gpt-4o",
  planner: "gateway:openai/gpt-4o",
  background: "gateway:openai/gpt-4o-mini",
  voice: "gateway:openai/gpt-4o-mini",
  fast: "gateway:openai/gpt-4o-mini",
};

const ENV_VAR_MAP: Record<ModelRole, string> = {
  chat: "AI_CHAT_MODEL",
  orchestrator: "AI_ORCHESTRATOR_MODEL",
  planner: "AI_PLANNER_MODEL",
  background: "AI_BACKGROUND_MODEL",
  voice: "AI_VOICE_MODEL",
  fast: "AI_FAST_MODEL",
};

// Estimated latencies by provider (ms)
const PROVIDER_LATENCY: Record<ModelProvider, number> = {
  cerebras: 200, // Very fast
  openrouter: 800, // Variable, depends on underlying model
  openai: 500,
  gateway: 500,
};

// ============================================================================
// Model Selection
// ============================================================================

/**
 * Resolve which model reference to use for a role
 * Precedence: user preference → env var → default
 */
export async function resolveModelRefForRole(
  role: ModelRole,
  opts?: { userId?: string }
): Promise<{ modelRef: ModelRefString; source: "user" | "env" | "fallback" }> {
  // 1. Check user preference
  if (opts?.userId) {
    const manager = getBudgetManager(opts.userId);
    const preferred = await manager.getPreferredModel(role);
    if (preferred) {
      return { modelRef: preferred, source: "user" };
    }
  }

  // 2. Check environment variable
  const envVar = ENV_VAR_MAP[role];
  const envValue = process.env[envVar];
  if (envValue) {
    return { modelRef: envValue, source: "env" };
  }

  // 3. Legacy fallback for AI_MODEL
  if (process.env.AI_MODEL) {
    const legacy = process.env.AI_MODEL;
    // If it doesn't have a provider prefix, add gateway
    const ref = legacy.includes(":") ? legacy : `gateway:${legacy}`;
    return { modelRef: ref, source: "env" };
  }

  // 4. Default
  return { modelRef: DEFAULT_MODELS[role], source: "fallback" };
}

/**
 * Get a language model for a specific role
 */
export async function getModelForRole(
  role: ModelRole,
  opts?: ModelSelectionOptions
): Promise<ModelSelection> {
  const { modelRef, source } = await resolveModelRefForRole(role, opts);

  // Check budget if requested
  let budgetResult: BudgetCheckResult | undefined;
  let actualModelRef = modelRef;

  if (opts?.budgetCheck && opts?.userId) {
    const manager = getBudgetManager(opts.userId);
    // Estimate tokens based on role
    const estimatedTokens =
      role === "background" ? 500 : role === "fast" ? 200 : 2000;
    budgetResult = await manager.checkBudget(role, modelRef, estimatedTokens);

    if (!budgetResult.allowed) {
      if (opts.fallbackOnBudgetExceeded && budgetResult.suggestedModel) {
        actualModelRef = budgetResult.suggestedModel;
        logger.info("model_budget_fallback", {
          originalModel: modelRef,
          fallbackModel: actualModelRef,
          reason: budgetResult.reason,
        });
      } else {
        throw new Error(`budget_exceeded:${budgetResult.reason}`);
      }
    }
  }

  // Check latency constraint
  const ref = parseModelRef(actualModelRef);
  const estimatedLatency = PROVIDER_LATENCY[ref.provider];

  if (opts?.maxLatencyMs && estimatedLatency > opts.maxLatencyMs) {
    // Try to find a faster provider
    if (ref.provider !== "cerebras" && process.env.CEREBRAS_API_KEY) {
      logger.info("model_latency_fallback", {
        originalModel: actualModelRef,
        reason: `latency ${estimatedLatency}ms > max ${opts.maxLatencyMs}ms`,
      });
      // Suggest Cerebras for latency-sensitive requests
      actualModelRef = "cerebras:llama3.1-8b";
    }
  }

  // Build the model
  const model = await buildModel(actualModelRef);

  // Get cost info
  const { getModelCost, getCostPer1k } = await import("./budget/costs");
  const costPer1k = getCostPer1k(actualModelRef);
  const finalRef = parseModelRef(actualModelRef);

  logger.debug("model_selected", {
    role,
    modelKey: actualModelRef,
    source,
    provider: finalRef.provider,
    budgetAllowed: budgetResult?.allowed ?? true,
  });

  return {
    model,
    modelKey: actualModelRef,
    provider: finalRef.provider,
    estimatedLatencyMs: PROVIDER_LATENCY[finalRef.provider],
    estimatedCostPer1k: costPer1k,
  };
}

/**
 * Build a language model from a model reference
 */
async function buildModel(modelRef: ModelRefString): Promise<LanguageModel> {
  const ref = parseModelRef(modelRef);

  switch (ref.provider) {
    case "cerebras": {
      const provider = await getCerebrasProvider();
      return provider(ref.id) as LanguageModel;
    }
    case "openrouter": {
      const provider = await getOpenRouterProvider();
      return provider.chat(ref.id) as LanguageModel;
    }
    case "openai":
    case "gateway": {
      const provider = await getGatewayProvider();
      return provider.languageModel(ref.id) as LanguageModel;
    }
    default:
      throw new Error(`unsupported_provider:${ref.provider}`);
  }
}

/**
 * Get model key string for a role (for metrics/logging)
 */
export async function getModelKeyForRole(
  role: ModelRole,
  opts?: { userId?: string }
): Promise<string> {
  const { modelRef } = await resolveModelRefForRole(role, opts);
  return modelRef;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a provider is available (has API key configured)
 */
export function isProviderAvailable(provider: ModelProvider): boolean {
  switch (provider) {
    case "cerebras":
      return !!process.env.CEREBRAS_API_KEY;
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "openai":
    case "gateway":
      return !!(process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY);
    default:
      return false;
  }
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];
  if (isProviderAvailable("cerebras")) providers.push("cerebras");
  if (isProviderAvailable("openrouter")) providers.push("openrouter");
  if (isProviderAvailable("gateway")) providers.push("gateway");
  return providers;
}

/**
 * Clear cached provider instances (for testing)
 */
export function clearProviderCache(): void {
  cerebrasProvider = null;
  openrouterProvider = null;
  gatewayProvider = null;
}
