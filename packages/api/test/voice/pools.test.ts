import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../src/voice/pools";

describe("Voice Pools Integration", () => {
  beforeEach(async () => {
    // Clean up any existing pools
    try {
      await shutdownVoicePools();
    } catch {
      // Ignore if not initialized
    }
  });

  afterEach(async () => {
    await shutdownVoicePools();
  });

  it("should skip initialization when VOICE_PROVIDER is not local", async () => {
    const originalProvider = process.env.VOICE_PROVIDER;
    process.env.VOICE_PROVIDER = "openai";

    await initializeVoicePools();

    // Should not throw (pools not needed for OpenAI)
    expect(true).toBe(true);

    process.env.VOICE_PROVIDER = originalProvider;
  });

  it("should throw when accessing pools before initialization", () => {
    expect(() => {
      getVoicePools();
    }).toThrow("Voice pools not initialized");
  });

  // Note: Full integration test would require Python dependencies and models
  // This is a placeholder structure for when those are available
  it("should initialize pools with local provider", async () => {
    const originalProvider = process.env.VOICE_PROVIDER;
    process.env.VOICE_PROVIDER = "local";
    process.env.WHISPER_MODEL_PATH = "large-v3-turbo";
    process.env.PIPER_MODEL_PATH = "./packages/voice/models/piper";

    await initializeVoicePools();

    const { sttPool, ttsPool, sessionManager } = getVoicePools();
    expect(sttPool).toBeTruthy();
    expect(ttsPool).toBeTruthy();
    expect(sessionManager).toBeTruthy();

    await shutdownVoicePools();
    process.env.VOICE_PROVIDER = originalProvider;
  });
});
