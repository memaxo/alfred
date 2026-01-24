import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

const { getModelForRole } = await import("./selector");

const LIVE = process.env.ALFRED_LIVE_PROVIDER_TESTS === "1";
const HAS_KEY = Boolean(process.env.CEREBRAS_API_KEY?.trim());

const maybeDescribe = LIVE && HAS_KEY ? describe : describe.skip;

const ENV_KEYS = ["AI_MODEL_CHAT", "AI_MODEL_REF_CHAT"] as const;
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

maybeDescribe("Cerebras provider (live smoke)", () => {
  beforeEach(() => {
    setEnv("AI_MODEL_REF_CHAT", undefined);
    setEnv("AI_MODEL_CHAT", "cerebras:llama3.1-8b");
  });

  afterEach(() => {
    restoreEnv();
  });

  it(
    "can generate a minimal completion via getModelForRole(chat)",
    async () => {
      const selection = getModelForRole("chat");
      expect(selection.modelKey).toBe("cerebras/llama3.1-8b");

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30_000);
      (timer as unknown as { unref?: () => void }).unref?.();

      try {
        const res = await generateText({
          model: selection.model,
          prompt: "Reply with exactly: cerebras_ok",
          temperature: 0,
          maxOutputTokens: 16,
          maxRetries: 1,
          abortSignal: ac.signal,
        });

        // Keep strict: this is a smoke test for provider correctness.
        expect(res.text.trim()).toBe("cerebras_ok");
      } finally {
        clearTimeout(timer);
      }
    },
    { timeout: 60_000 }
  );
});
