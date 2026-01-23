export const MODEL_ROLES = [
  "chat",
  "orchestrator",
  "planner",
  "background",
  "voice",
  "classify",
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

/**
 * Model capabilities for feature selection.
 */
export const MODEL_CAPABILITIES = [
  "genui", // Supports structured output for generative UI
  "tools", // Supports tool calling
  "vision", // Supports image input
  "streaming", // Supports streaming responses
  "reasoning", // Extended reasoning (o1-style)
] as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export function isModelCapability(v: unknown): v is ModelCapability {
  if (typeof v !== "string") {
    return false;
  }
  return (MODEL_CAPABILITIES as readonly string[]).includes(v);
}

export const MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "cerebras",
  "deepseek",
  "mistral",
  "xai",
  "local",
] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export type ModelRef = string & { readonly __brand: "ModelRef" };

export type ParsedModelRef = {
  provider: ModelProvider;
  modelId: string;
  ref: ModelRef;
};

export type ModelKey = string & { readonly __brand: "ModelKey" };

export type ParsedModelKey = {
  provider: ModelProvider;
  modelId: string;
  key: ModelKey;
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

export function parseModelKey(value: string): ParsedModelKey {
  const raw = value.trim();
  if (raw.length === 0) {
    throw new Error("model_key_empty");
  }

  const i = raw.indexOf("/");
  if (i === -1) {
    throw new Error("model_key_missing_slash");
  }

  const providerRaw = raw.slice(0, i).trim();
  if (providerRaw.length === 0) {
    throw new Error("model_key_provider_empty");
  }

  const modelIdRaw = raw.slice(i + 1).trim();
  if (modelIdRaw.length === 0) {
    throw new Error("model_key_modelid_empty");
  }

  if (!isModelProvider(providerRaw)) {
    throw new Error("model_key_provider_unknown");
  }

  const provider = providerRaw;
  const modelId = modelIdRaw;
  const key = `${provider}/${modelId}` as ModelKey;

  return { provider, modelId, key };
}
