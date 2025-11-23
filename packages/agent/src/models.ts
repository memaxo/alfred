export type ModelSpec = {
  id: string;
  contextWindow: number;
};

export const KNOWN_MODELS: Record<string, ModelSpec> = {
  "openai/gpt-4o-mini": { id: "openai/gpt-4o-mini", contextWindow: 128_000 },
  "openai/gpt-4o": { id: "openai/gpt-4o", contextWindow: 128_000 },
  "google/gemini-1.5-pro": { id: "google/gemini-1.5-pro", contextWindow: 1_000_000 },
  "google/gemini-1.5-flash": { id: "google/gemini-1.5-flash", contextWindow: 1_000_000 },
  "anthropic/claude-3-5-sonnet-20240620": { id: "anthropic/claude-3-5-sonnet-20240620", contextWindow: 200_000 },
};

export const DEFAULT_CONTEXT_WINDOW = 128_000;

export function getModelSpec(modelId: string): ModelSpec {
  return (
    KNOWN_MODELS[modelId] ?? {
      id: modelId,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
    }
  );
}
