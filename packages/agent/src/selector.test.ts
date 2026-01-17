import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { PreferenceDetail, PreferenceKey } from "@alfred/type/preference";

const loader = await import("./preference/loader");
const { getModelForRole } = await import("./selector");
const { resetGatewayForTests } = await import("./v6");

const ENV_KEYS = [
  "NODE_ENV",
  "OPENAI_API_KEY",
  "AI_GATEWAY_API_KEY",
  "OPENROUTER_API_KEY",
  "CEREBRAS_API_KEY",
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

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv[key]);
  }
}

function makePrefs(
  entries: Record<string, string>
): Map<PreferenceKey, PreferenceDetail> {
  const prefs = new Map<PreferenceKey, PreferenceDetail>();
  for (const [key, value] of Object.entries(entries)) {
    prefs.set(key as PreferenceKey, {
      value,
      source: "user",
      confidence: 1,
    });
  }
  return prefs;
}

beforeEach(() => {
  resetGatewayForTests();
  setEnv("OPENAI_API_KEY", "test-key");
  setEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  setEnv("CEREBRAS_API_KEY", "test-cerebras-key");
  vi.restoreAllMocks();
});

afterEach(() => {
  resetGatewayForTests();
  restoreEnv();
  vi.restoreAllMocks();
});

describe("getModelForRole", () => {
  it("prefers user preferences over env defaults", async () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");

    const spy = vi.spyOn(loader, "loadPreferences");
    spy.mockResolvedValue(
      makePrefs({
        "domain.ai.model.chat": "openrouter:anthropic/claude-3.5-sonnet",
      })
    );

    const { modelKey } = await getModelForRole("chat", { userId: "user-1" });
    expect(modelKey).toBe("openrouter/anthropic/claude-3.5-sonnet");
  });

  it("falls back when user preference is invalid", async () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");

    const spy = vi.spyOn(loader, "loadPreferences");
    spy.mockResolvedValue(
      makePrefs({
        "domain.ai.model.chat": "unknown/model",
      })
    );

    const { modelKey } = await getModelForRole("chat", { userId: "user-1" });
    expect(modelKey).toBe("openai/gpt-4o-mini");
  });

  it("falls back when user preference value is not a string", async () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");

    const spy = vi.spyOn(loader, "loadPreferences");
    spy.mockResolvedValue(
      new Map([
        [
          "domain.ai.model.chat" as PreferenceKey,
          { value: 123, source: "user", confidence: 1 } as PreferenceDetail,
        ],
      ])
    );

    const { modelKey } = await getModelForRole("chat", { userId: "user-1" });
    expect(modelKey).toBe("openai/gpt-4o-mini");
  });

  it("prefers env defaults over explicit fallbacks", () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("openai/gpt-4o");
  });

  it("prefers AI_MODEL_REF_CHAT over AI_MODEL_CHAT", () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");
    setEnv("AI_MODEL_REF_CHAT", "openrouter:anthropic/claude-3.5-sonnet");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("openrouter/anthropic/claude-3.5-sonnet");
  });

  it("returns a stable modelKey suitable for history/metrics", () => {
    setEnv("AI_MODEL_CHAT", "openrouter:anthropic/claude-3.5-sonnet");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("openrouter/anthropic/claude-3.5-sonnet");
    expect(modelKey.includes(":")).toBe(false);
    expect(modelKey.includes("/")).toBe(true);
  });

  it("throws a clear error when the gateway API key is missing", () => {
    resetGatewayForTests();
    setEnv("NODE_ENV", "production");
    setEnv("OPENAI_API_KEY", undefined);
    setEnv("AI_GATEWAY_API_KEY", undefined);
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o-mini");

    expect(() => getModelForRole("chat")).toThrow(
      "ai_provider_api_key_missing"
    );
  });

  it("throws clear error for missing Cerebras key", () => {
    setEnv("CEREBRAS_API_KEY", undefined);
    setEnv("AI_MODEL_CHAT", "cerebras:llama3.1-8b");

    expect(() => getModelForRole("chat")).toThrow("cerebras_api_key_missing");
  });

  it("throws clear error for missing OpenRouter key", () => {
    setEnv("OPENROUTER_API_KEY", undefined);
    setEnv("AI_MODEL_CHAT", "openrouter:anthropic/claude-3.5-sonnet");

    expect(() => getModelForRole("chat")).toThrow("openrouter_api_key_missing");
  });

  it("routes cerebras provider correctly", () => {
    setEnv("AI_MODEL_CHAT", "cerebras:llama3.1-70b");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("cerebras/llama3.1-70b");
  });

  it("routes openrouter provider correctly", () => {
    setEnv("AI_MODEL_CHAT", "openrouter:anthropic/claude-3-haiku");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("openrouter/anthropic/claude-3-haiku");
  });

  it("routes openai provider to gateway", () => {
    setEnv("AI_MODEL_CHAT", "openai:gpt-4o");

    const { modelKey } = getModelForRole("chat");
    expect(modelKey).toBe("openai/gpt-4o");
  });
});
