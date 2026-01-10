import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { resolveModelKey } from "../src/ai/model";

const ENV_KEYS = [
  "AI_MODEL_REF",
  "AI_MODEL_REF_CHAT",
  "AI_MODEL_REF_ORCHESTRATOR",
  "AI_MODEL_REF_PLANNER",
  "AI_MODEL_REF_BACKGROUND",
  "AI_MODEL_REF_VOICE",
  "AI_MODEL",
  "OPENAI_MODEL",
  "MASTRA_MODEL",
  "AI_MODEL_CHAT",
  "AI_MODEL_ORCHESTRATOR",
  "AI_MODEL_PLANNER",
  "AI_MODEL_BACKGROUND",
  "AI_MODEL_VOICE",
  "AI_MODEL_PLAN",
  "OPENAI_MODEL_PLAN",
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

describe("resolveModelKey", () => {
  it("prefers AI_MODEL_REF_CHAT over AI_MODEL_CHAT", () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");
    setEnv("AI_MODEL_REF_CHAT", "openrouter:anthropic/claude-3.5-sonnet");

    expect(resolveModelKey({ role: "chat" })).toBe(
      "openrouter/anthropic/claude-3.5-sonnet"
    );
  });

  it("uses AI_MODEL_CHAT when no AI_MODEL_REF_CHAT exists", () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o");
    expect(resolveModelKey({ role: "chat" })).toBe("openai/gpt-4o");
  });

  it("uses AI_MODEL_REF as a global fallback", () => {
    setEnv("AI_MODEL_REF", "openrouter:anthropic/claude-3.5-sonnet");
    expect(resolveModelKey({ role: "chat" })).toBe(
      "openrouter/anthropic/claude-3.5-sonnet"
    );
  });

  it("supports legacy AI_MODEL in provider/model form", () => {
    setEnv("AI_MODEL", "openai/gpt-4o-mini");
    expect(resolveModelKey({ role: "chat" })).toBe("openai/gpt-4o-mini");
  });

  it("supports legacy AI_MODEL in bare modelId form", () => {
    setEnv("AI_MODEL", "gpt-4o-mini");
    expect(resolveModelKey({ role: "chat" })).toBe("openai/gpt-4o-mini");
  });

  it("rejects unknown providers", () => {
    setEnv("AI_MODEL_CHAT", "gateway:gpt-4o-mini");
    expect(() => resolveModelKey({ role: "chat" })).toThrow(
      "model_ref_provider_unknown"
    );
  });
});
