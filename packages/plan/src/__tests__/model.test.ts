import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getModelId } from "../ai.js";

const ENV_KEYS = [
  "AI_MODEL_REF_PLANNER",
  "AI_MODEL_PLANNER",
  "AI_MODEL_PLAN",
  "OPENAI_MODEL_PLAN",
  "AI_MODEL_REF",
  "AI_MODEL",
  "OPENAI_MODEL",
  "MASTRA_MODEL",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const originalEnv: Record<EnvKey, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]])
) as Record<EnvKey, string | undefined>;

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    setEnv(key, undefined);
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv[key]);
  }
}

beforeEach(() => {
  clearEnv();
});

afterEach(() => {
  restoreEnv();
});

describe("@alfred/plan getModelId", () => {
  it("prefers AI_MODEL_REF_PLANNER over AI_MODEL_PLANNER", () => {
    setEnv("AI_MODEL_PLANNER", "openai:gpt-4o-mini");
    setEnv("AI_MODEL_REF_PLANNER", "openrouter:anthropic/claude-3.5-sonnet");
    expect(getModelId()).toBe("openrouter/anthropic/claude-3.5-sonnet");
  });

  it("uses AI_MODEL_PLANNER when no AI_MODEL_REF_PLANNER exists", () => {
    setEnv("AI_MODEL_PLANNER", "cerebras:llama3.1-70b");
    expect(getModelId()).toBe("cerebras/llama3.1-70b");
  });

  it("uses AI_MODEL_PLAN / OPENAI_MODEL_PLAN for back-compat", () => {
    setEnv("AI_MODEL_PLAN", "gpt-4o-mini");
    expect(getModelId()).toBe("openai/gpt-4o-mini");
  });

  it("uses AI_MODEL_REF as a global fallback", () => {
    setEnv("AI_MODEL_REF", "openai:gpt-4o-mini");
    expect(getModelId()).toBe("openai/gpt-4o-mini");
  });

  it("supports legacy AI_MODEL in provider/model form", () => {
    setEnv("AI_MODEL", "openai/gpt-4o-mini");
    expect(getModelId()).toBe("openai/gpt-4o-mini");
  });

  it("supports legacy AI_MODEL in bare modelId form", () => {
    setEnv("AI_MODEL", "gpt-4o-mini");
    expect(getModelId()).toBe("openai/gpt-4o-mini");
  });

  it("uses openai/gpt-4o by default", () => {
    expect(getModelId()).toBe("openai/gpt-4o");
  });

  it("rejects unknown providers", () => {
    setEnv("AI_MODEL_PLANNER", "gateway:gpt-4o");
    expect(() => getModelId()).toThrow("model_ref_provider_unknown");
  });
});
