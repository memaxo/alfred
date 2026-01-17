import { createCerebras } from "@ai-sdk/cerebras";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import {
  type ModelRef,
  type ModelRole,
  parseModelRef,
  toModelKey,
} from "@alfred/type/model";
import type { PreferenceDetail, PreferenceKey } from "@alfred/type/preference";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type LanguageModel, wrapLanguageModel } from "ai";

import * as prefLoader from "./preference/loader";
import { getOpenAI } from "./v6";

export type ModelSelection = {
  model: LanguageModel;
  modelKey: string;
};

export type ModelSelectionOpts = {
  userId?: string;
  projectId?: string;
};

const ENV_KEYS: Record<ModelRole, string> = {
  chat: "AI_MODEL_CHAT",
  orchestrator: "AI_MODEL_ORCHESTRATOR",
  planner: "AI_MODEL_PLANNER",
  background: "AI_MODEL_BACKGROUND",
  voice: "AI_MODEL_VOICE",
};

const ENV_KEYS_REF: Record<ModelRole, string> = {
  chat: "AI_MODEL_REF_CHAT",
  orchestrator: "AI_MODEL_REF_ORCHESTRATOR",
  planner: "AI_MODEL_REF_PLANNER",
  background: "AI_MODEL_REF_BACKGROUND",
  voice: "AI_MODEL_REF_VOICE",
};

const FALLBACK_REFS: Record<ModelRole, ModelRef> = {
  chat: parseModelRef("openai:gpt-4o-mini").ref,
  orchestrator: parseModelRef("openai:gpt-4o-mini").ref,
  planner: parseModelRef("openai:gpt-4o").ref,
  background: parseModelRef("openai:gpt-4o-mini").ref,
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

function buildSelection(ref: ModelRef): ModelSelection {
  const { provider, modelId } = parseModelRef(ref);
  const modelKey = toModelKey(ref);

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
    default:
      // OpenAI, Anthropic, Google all use gateway/OpenAI provider
      model = getOpenAI()(modelKey) as LanguageModel;
      break;
  }

  if (
    process.env.AI_DEVTOOLS === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    model = wrapLanguageModel({
      model: model as unknown as Parameters<
        typeof wrapLanguageModel
      >[0]["model"],
      middleware: devToolsMiddleware() as unknown as Parameters<
        typeof wrapLanguageModel
      >[0]["middleware"],
    }) as unknown as LanguageModel;
  }
  return { model, modelKey };
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
    const userId = opts.userId;
    const projectId = opts.projectId;
    return (async () => {
      const user = await readUserModelForRole(role, userId, projectId);
      const ref = user ?? resolveRefSync(role);
      return buildSelection(ref);
    })();
  }

  return buildSelection(resolveRefSync(role));
}
