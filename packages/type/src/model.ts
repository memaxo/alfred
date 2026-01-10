export const MODEL_ROLES = [
  "chat",
  "orchestrator",
  "planner",
  "background",
  "voice",
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

export const MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "cerebras",
] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export type ModelRef = string & { readonly __brand: "ModelRef" };

export type ParsedModelRef = {
  provider: ModelProvider;
  modelId: string;
  ref: ModelRef;
};

export function isModelRole(v: unknown): v is ModelRole {
  if (typeof v !== "string") {
    return false;
  }
  return (MODEL_ROLES as readonly string[]).includes(v);
}

export function isModelProvider(v: unknown): v is ModelProvider {
  if (typeof v !== "string") {
    return false;
  }
  return (MODEL_PROVIDERS as readonly string[]).includes(v);
}

export function parseModelRef(value: string): ParsedModelRef {
  const raw = value.trim();
  if (raw.length === 0) {
    throw new Error("model_ref_empty");
  }

  const i = raw.indexOf(":");
  if (i === -1) {
    throw new Error("model_ref_missing_colon");
  }

  const providerRaw = raw.slice(0, i).trim();
  if (providerRaw.length === 0) {
    throw new Error("model_ref_provider_empty");
  }

  const modelIdRaw = raw.slice(i + 1).trim();
  if (modelIdRaw.length === 0) {
    throw new Error("model_ref_modelid_empty");
  }

  if (!isModelProvider(providerRaw)) {
    throw new Error("model_ref_provider_unknown");
  }

  const provider = providerRaw;
  const modelId = modelIdRaw;
  const ref = `${provider}:${modelId}` as ModelRef;

  return { provider, modelId, ref };
}

export function toModelKey(ref: ModelRef): string {
  return ref.replace(":", "/");
}
