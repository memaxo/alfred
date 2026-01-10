import { createGatewayProvider } from "@ai-sdk/gateway";
import { type ModelRef, parseModelRef, toModelKey } from "@alfred/type/model";

/**
 * Shared AI configuration for @alfred/plan
 * This breaks the circular dependency with @alfred/agent.
 */

const FALLBACK_REF: ModelRef = parseModelRef("openai:gpt-4o").ref;

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

function normalizeModelKey(raw: string): string {
  return toModelKey(parseModelRef(coerceModelRef(raw)).ref);
}

export function getModelId(): string {
  const plannerRef = firstEnv("AI_MODEL_REF_PLANNER", "AI_MODEL_PLANNER");
  if (plannerRef) {
    return normalizeModelKey(plannerRef);
  }

  const legacyPlan = firstEnv("AI_MODEL_PLAN", "OPENAI_MODEL_PLAN");
  if (legacyPlan) {
    return normalizeModelKey(legacyPlan);
  }

  const globalRef = firstEnv("AI_MODEL_REF");
  if (globalRef) {
    return normalizeModelKey(globalRef);
  }

  const legacyGlobal = firstEnv("AI_MODEL", "OPENAI_MODEL", "MASTRA_MODEL");
  if (legacyGlobal) {
    return normalizeModelKey(legacyGlobal);
  }

  return toModelKey(FALLBACK_REF);
}

let cachedGateway: ReturnType<typeof createGatewayProvider> | null = null;

export function getOpenAI() {
  if (cachedGateway) {
    return (id: string) => cachedGateway?.languageModel(id);
  }

  // Test override: allow empty client in tests if key is missing
  if (process.env.NODE_ENV === "test" && !process.env.OPENAI_API_KEY) {
    return (_id: string) => ({}) as any;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  cachedGateway = createGatewayProvider({
    apiKey,
  });

  return (id: string) => cachedGateway?.languageModel(id);
}
