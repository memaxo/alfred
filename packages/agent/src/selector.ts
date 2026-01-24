import { createCerebras } from "@ai-sdk/cerebras";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  type ModelCapability,
  type ModelRef,
  type ModelRole,
  parseModelRef,
  toModelKey,
} from "@alfred/type/model";
import {
  type PreferenceDetail,
  type PreferenceKey,
} from "@alfred/type/preference";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type LanguageModel,
  simulateStreamingMiddleware,
  wrapLanguageModel,
} from "ai";
import { MockLanguageModelV3 } from "ai/test";

import * as prefLoader from "./preference/loader";
import { getOpenAI } from "./v6";

export interface ModelSelection {
  model: LanguageModel;
  modelKey: string;
  capabilities: ModelCapability[];
}

export interface ModelSelectionOpts {
  userId?: string;
  projectId?: string;
}

/**
 * Known model capabilities by model ID pattern.
 *
 * Models support GenUI if they can produce reliable structured JSON output
 * via JSON mode or tool calling. Most modern models support this.
 */
const MODEL_CAPABILITY_MAP: Record<string, ModelCapability[]> = {
  // OpenAI models
  "gpt-4o": ["genui", "tools", "vision", "streaming"],
  "gpt-4o-mini": ["genui", "tools", "vision", "streaming"],
  "gpt-4-turbo": ["genui", "tools", "vision", "streaming"],
  "gpt-4": ["genui", "tools", "streaming"],
  "gpt-3.5-turbo": ["genui", "tools", "streaming"],
  o1: ["genui", "tools", "reasoning", "streaming"],
  "o1-mini": ["genui", "tools", "reasoning", "streaming"],
  "o1-preview": ["genui", "tools", "reasoning", "streaming"],
  "o3-mini": ["genui", "tools", "reasoning", "streaming"],

  // Anthropic models (via OpenRouter or gateway)
  "claude-3.5-sonnet": ["genui", "tools", "vision", "streaming"],
  "claude-3-5-sonnet": ["genui", "tools", "vision", "streaming"],
  "claude-3-opus": ["genui", "tools", "vision", "streaming"],
  "claude-3-sonnet": ["genui", "tools", "vision", "streaming"],
  "claude-3-haiku": ["genui", "tools", "vision", "streaming"],

  // Google models
  "gemini-2.0-flash": ["genui", "tools", "vision", "streaming"],
  "gemini-1.5-pro": ["genui", "tools", "vision", "streaming"],
  "gemini-1.5-flash": ["genui", "tools", "vision", "streaming"],

  // Cerebras models (fast inference)
  "llama3.1-8b": ["tools", "streaming"],
  "llama3.1-70b": ["tools", "streaming"],

  // Cerebras GPT-OSS models (fast inference, structured output support)
  "gpt-oss-120b": ["genui", "tools", "streaming"],
  "gpt-oss-20b": ["genui", "tools", "streaming"],

  // Default: assume basic capabilities
  default: ["streaming"],
};

/**
 * Get capabilities for a model by checking model ID patterns.
 */
function getModelCapabilities(modelId: string): ModelCapability[] {
  // Check for exact match first
  if (MODEL_CAPABILITY_MAP[modelId]) {
    return MODEL_CAPABILITY_MAP[modelId];
  }

  // Check for partial matches (e.g., "gpt-4o-2024-08-06" should match "gpt-4o")
  for (const [pattern, capabilities] of Object.entries(MODEL_CAPABILITY_MAP)) {
    if (pattern !== "default" && modelId.includes(pattern)) {
      return capabilities;
    }
  }

  // Check OpenRouter model IDs (format: provider/model)
  const slashIndex = modelId.indexOf("/");
  if (slashIndex !== -1) {
    const modelPart = modelId.slice(slashIndex + 1);
    return getModelCapabilities(modelPart);
  }

  return MODEL_CAPABILITY_MAP.default ?? [];
}

/**
 * Check if a model selection supports a specific capability.
 */
export function hasCapability(
  selection: ModelSelection,
  capability: ModelCapability
): boolean {
  return selection.capabilities.includes(capability);
}

/**
 * Check if a model selection supports GenUI (structured output).
 */
export function supportsGenUI(selection: ModelSelection): boolean {
  return hasCapability(selection, "genui");
}

const ENV_KEYS: Record<ModelRole, string> = {
  background: "AI_MODEL_BACKGROUND",
  chat: "AI_MODEL_CHAT",
  classify: "AI_MODEL_CLASSIFY",
  orchestrator: "AI_MODEL_ORCHESTRATOR",
  planner: "AI_MODEL_PLANNER",
  voice: "AI_MODEL_VOICE",
};

const ENV_KEYS_REF: Record<ModelRole, string> = {
  background: "AI_MODEL_REF_BACKGROUND",
  chat: "AI_MODEL_REF_CHAT",
  classify: "AI_MODEL_REF_CLASSIFY",
  orchestrator: "AI_MODEL_REF_ORCHESTRATOR",
  planner: "AI_MODEL_REF_PLANNER",
  voice: "AI_MODEL_REF_VOICE",
};

const FALLBACK_REFS: Record<ModelRole, ModelRef> = {
  background: parseModelRef("openai:gpt-4o-mini").ref,
  chat: parseModelRef("openai:gpt-4o-mini").ref,
  classify: parseModelRef("cerebras:gpt-oss-120b").ref,
  orchestrator: parseModelRef("openai:gpt-4o-mini").ref,
  planner: parseModelRef("openai:gpt-4o").ref,
  voice: parseModelRef("openai:gpt-4o-mini").ref,
};

function firstEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function coerceModelRef(raw: string): string {
  const value = raw.trim();
  if (value.length === 0) {
    return value;
  }
  if (value.includes(":")) {
    return value;
  }

  const slash = value.indexOf("/");
  if (slash !== -1) {
    const provider = value.slice(0, slash).trim();
    const modelId = value.slice(slash + 1).trim();
    return `${provider}:${modelId}`;
  }

  // Back-compat: older env variables used bare model ids (assume OpenAI).
  return `openai:${value}`;
}

function preferenceKeyForRole(role: ModelRole): PreferenceKey {
  return `domain.ai.model.${role}` as PreferenceKey;
}

export async function readUserModelForRole(
  role: ModelRole,
  userId: string,
  projectId?: string
): Promise<ModelRef | null> {
  const prefs = await prefLoader.loadPreferences(userId, projectId);
  const key = preferenceKeyForRole(role);
  const pref = prefs.get(key);
  if (!pref) {
    return null;
  }

  try {
    const value = extractStringPrefValue(pref, key);
    return parseModelRef(coerceModelRef(value)).ref;
  } catch {
    return null;
  }
}

function extractStringPrefValue(
  pref: PreferenceDetail,
  key: PreferenceKey
): string {
  const v = pref.value;
  if (typeof v === "string") {
    return v;
  }
  throw new Error(`model_selector_pref_not_string key=${key}`);
}

export function readEnvModelForRole(role: ModelRole): ModelRef | null {
  const roleRef = firstEnv(ENV_KEYS_REF[role]);
  if (roleRef) {
    return parseModelRef(coerceModelRef(roleRef)).ref;
  }

  const roleEnv = firstEnv(ENV_KEYS[role]);
  if (roleEnv) {
    return parseModelRef(coerceModelRef(roleEnv)).ref;
  }

  // Legacy role-specific env used by workflow planning paths.
  if (role === "planner") {
    const legacyPlan = firstEnv("AI_MODEL_PLAN", "OPENAI_MODEL_PLAN");
    if (legacyPlan) {
      return parseModelRef(coerceModelRef(legacyPlan)).ref;
    }
  }

  // Legacy global env used across the agent.
  const globalRef = firstEnv("AI_MODEL_REF");
  if (globalRef) {
    return parseModelRef(coerceModelRef(globalRef)).ref;
  }

  const legacyGlobal = firstEnv("AI_MODEL", "OPENAI_MODEL", "MASTRA_MODEL");
  if (legacyGlobal) {
    return parseModelRef(coerceModelRef(legacyGlobal)).ref;
  }

  return null;
}

function resolveRefSync(role: ModelRole): ModelRef {
  return readEnvModelForRole(role) ?? FALLBACK_REFS[role];
}

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function hasGatewayKey(): boolean {
  const k1 = process.env.AI_GATEWAY_API_KEY;
  if (k1 && k1.trim().length > 0) {
    return true;
  }
  const k2 = process.env.OPENAI_API_KEY;
  if (k2 && k2.trim().length > 0) {
    return true;
  }
  return false;
}

function isMissingKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message;
  return (
    msg.includes("ai_provider_api_key_missing") ||
    msg.includes("AI_GATEWAY_API_KEY") ||
    msg.includes("OPENAI_API_KEY")
  );
}

function createDevFallbackModel(): LanguageModel {
  const base = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: "Mock Alfred (no API key). Set AI_GATEWAY_API_KEY or OPENAI_API_KEY to enable real responses.",
        },
      ],
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    }),
  });

  // Ensure streamText gets a streaming-capable model surface.
  return wrapLanguageModel({
    middleware: simulateStreamingMiddleware() as unknown as Parameters<
      typeof wrapLanguageModel
    >[0]["middleware"],
    model: base as unknown as Parameters<typeof wrapLanguageModel>[0]["model"],
  }) as unknown as LanguageModel;
}

function buildSelection(ref: ModelRef): ModelSelection {
  const { provider, modelId } = parseModelRef(ref);
  const modelKey = toModelKey(ref);
  const capabilities = getModelCapabilities(modelId);

  let model: LanguageModel;

  switch (provider) {
    case "cerebras": {
      const apiKey = process.env.CEREBRAS_API_KEY;
      if (!apiKey) {
        throw new Error(
          "cerebras_api_key_missing: Set CEREBRAS_API_KEY environment variable"
        );
      }
      model = createCerebras({ apiKey })(modelId) as LanguageModel;
      break;
    }
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "openrouter_api_key_missing: Set OPENROUTER_API_KEY environment variable"
        );
      }
      model = createOpenRouter({ apiKey }).chat(
        modelId
      ) as unknown as LanguageModel;
      break;
    }
    case "local": {
      // OpenAI-compatible local server (e.g., vllm-mlx).
      // Must include `/v1` suffix (OpenAI base).
      const baseURL =
        process.env.LOCAL_OPENAI_BASE_URL?.trim() ??
        process.env.OPENAI_BASE_URL?.trim();
      if (!baseURL) {
        throw new Error(
          "openai_base_url_missing: Set LOCAL_OPENAI_BASE_URL (or OPENAI_BASE_URL) to an OpenAI-compatible /v1 endpoint (e.g. http://host.docker.internal:8000/v1)"
        );
      }

      // Optional: only needed if your local server enforces auth.
      const apiKey =
        process.env.LOCAL_OPENAI_API_KEY?.trim() ??
        process.env.OPENAI_API_KEY?.trim();

      const local = createOpenAICompatible({
        name: "local",
        baseURL,
        ...(apiKey ? { apiKey } : {}),
      });

      // Use the raw modelId from `local:<modelId>` so the server sees e.g. "default" or
      // "mlx-community/GLM-4.7-Flash-8bit-gs32" (not "local/<...>").
      model = local(modelId) as unknown as LanguageModel;
      break;
    }
    default: {
      // OpenAI, Anthropic, Google all use gateway/OpenAI provider
      if (isDev() && !hasGatewayKey()) {
        model = createDevFallbackModel();
        break;
      }
      try {
        model = getOpenAI()(modelKey) as LanguageModel;
      } catch (error) {
        if (isDev() && isMissingKeyError(error)) {
          model = createDevFallbackModel();
          break;
        }
        throw error;
      }
      break;
    }
  }

  if (
    process.env.AI_DEVTOOLS === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    model = wrapLanguageModel({
      middleware: devToolsMiddleware() as unknown as Parameters<
        typeof wrapLanguageModel
      >[0]["middleware"],
      model: model as unknown as Parameters<
        typeof wrapLanguageModel
      >[0]["model"],
    }) as unknown as LanguageModel;
  }
  return { capabilities, model, modelKey };
}

export function getModelForRole(role: ModelRole): ModelSelection;
export function getModelForRole(
  role: ModelRole,
  opts: { userId: string; projectId?: string }
): Promise<ModelSelection>;
export function getModelForRole(
  role: ModelRole,
  opts?: ModelSelectionOpts
): ModelSelection | Promise<ModelSelection>;
export function getModelForRole(
  role: ModelRole,
  opts?: ModelSelectionOpts
): ModelSelection | Promise<ModelSelection> {
  if (opts?.userId) {
    const { userId } = opts;
    const { projectId } = opts;
    return (async () => {
      const user = await readUserModelForRole(role, userId, projectId);
      const ref = user ?? resolveRefSync(role);
      return buildSelection(ref);
    })();
  }

  return buildSelection(resolveRefSync(role));
}

/**
 * Get a model optimized for classification tasks.
 * Uses Cerebras gpt-oss-120b by default for fast inference with structured output support.
 * Falls back to environment configuration or user preferences if available.
 */
export function getClassificationModel(): ModelSelection;
export function getClassificationModel(
  opts: ModelSelectionOpts & { userId: string }
): Promise<ModelSelection>;
export function getClassificationModel(
  opts?: ModelSelectionOpts
): ModelSelection | Promise<ModelSelection>;
export function getClassificationModel(
  opts?: ModelSelectionOpts
): ModelSelection | Promise<ModelSelection> {
  return getModelForRole("classify", opts);
}
