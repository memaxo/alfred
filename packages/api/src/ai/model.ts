import type { LanguageModel } from "ai";

import {
  type ModelRef,
  type ModelRole,
  parseModelRef,
  toModelKey,
} from "@alfred/type/model";

type ModelSource = "assistant" | "orchestrator";

const ENV_KEYS_REF: Record<ModelRole, string> = {
  chat: "AI_MODEL_REF_CHAT",
  orchestrator: "AI_MODEL_REF_ORCHESTRATOR",
  planner: "AI_MODEL_REF_PLANNER",
  background: "AI_MODEL_REF_BACKGROUND",
  voice: "AI_MODEL_REF_VOICE",
  classify: "AI_MODEL_REF_CLASSIFY",
};

const ENV_KEYS: Record<ModelRole, string> = {
  chat: "AI_MODEL_CHAT",
  orchestrator: "AI_MODEL_ORCHESTRATOR",
  planner: "AI_MODEL_PLANNER",
  background: "AI_MODEL_BACKGROUND",
  voice: "AI_MODEL_VOICE",
  classify: "AI_MODEL_CLASSIFY",
};

const FALLBACK_REFS: Record<ModelRole, ModelRef> = {
  chat: parseModelRef("openai:gpt-4o-mini").ref,
  orchestrator: parseModelRef("openai:gpt-4o-mini").ref,
  planner: parseModelRef("openai:gpt-4o").ref,
  background: parseModelRef("openai:gpt-4o-mini").ref,
  voice: parseModelRef("openai:gpt-4o-mini").ref,
  // Classification defaults to a fast structured-output model; can be overridden via env.
  classify: parseModelRef("cerebras:gpt-oss-120b").ref,
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

function normalizeModelKey(raw: string): string {
  return toModelKey(parseModelRef(coerceModelRef(raw)).ref);
}

export function modelRoleForSource(source: ModelSource): ModelRole {
  return source === "orchestrator" ? "orchestrator" : "chat";
}

export function resolveEnvModelRef(role: ModelRole): ModelRef {
  const roleRef = firstEnv(ENV_KEYS_REF[role]);
  if (roleRef) {
    return parseModelRef(coerceModelRef(roleRef)).ref;
  }

  const roleLegacy = firstEnv(ENV_KEYS[role]);
  if (roleLegacy) {
    return parseModelRef(coerceModelRef(roleLegacy)).ref;
  }

  if (role === "planner") {
    const legacyPlan = firstEnv("AI_MODEL_PLAN", "OPENAI_MODEL_PLAN");
    if (legacyPlan) {
      return parseModelRef(coerceModelRef(legacyPlan)).ref;
    }
  }

  const globalRef = firstEnv("AI_MODEL_REF");
  if (globalRef) {
    return parseModelRef(coerceModelRef(globalRef)).ref;
  }

  const legacyGlobal = firstEnv("AI_MODEL", "OPENAI_MODEL", "MASTRA_MODEL");
  if (legacyGlobal) {
    return parseModelRef(coerceModelRef(legacyGlobal)).ref;
  }

  return FALLBACK_REFS[role];
}

export function resolveModelKey(options: {
  role: ModelRole;
  model?: string | LanguageModel;
}): string {
  const { model } = options;
  if (typeof model === "string" && model.trim().length > 0) {
    return normalizeModelKey(model);
  }

  if (model && typeof model === "object") {
    const maybeModelId = (model as { modelId?: unknown }).modelId;
    if (typeof maybeModelId === "string" && maybeModelId.trim().length > 0) {
      return normalizeModelKey(maybeModelId);
    }
    const maybeId = (model as { id?: unknown }).id;
    if (typeof maybeId === "string" && maybeId.trim().length > 0) {
      return normalizeModelKey(maybeId);
    }
  }

  return toModelKey(resolveEnvModelRef(options.role));
}
