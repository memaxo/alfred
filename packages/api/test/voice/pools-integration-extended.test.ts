import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { hasPythonDependencies } from "@alfred/voice/test/utils/python-helpers";
import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../src/voice/pools";

/**
 * Check if Python dependencies are available for real integration tests
 */
async function checkPythonDependencies(): Promise<boolean> {
  try {
    // Try to import Python packages via a simple check
    return await hasPythonDependencies(["python3"]);
  } catch {
    return false;
  }
}

const hasPythonDeps = await checkPythonDependencies();

// Skip these tests in fast test runs - they require voice dependencies
const shouldSkip = !process.env.RUN_VOICE_TESTS;

describe.skipIf(shouldSkip)("Voice Pools Integration (Extended)", () => {
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

  it.skipIf(!hasPythonDeps)("should initialize with UV run", async () => {
    const originalProvider = process.env.VOICE_PROVIDER;
    const originalUseUv = process.env.VOICE_USE_UV;

    process.env.VOICE_PROVIDER = "maya1";
    process.env.VOICE_USE_UV = "true";
    process.env.WHISPER_MODEL_PATH = "large-v3-turbo";
    process.env.PIPER_MODEL_PATH = "./packages/voice/models/piper";

    await initializeVoicePools();

    const { sttPool, ttsPool, sessionManager } = getVoicePools();
    expect(sttPool).toBeTruthy();
    expect(ttsPool).toBeTruthy();
    expect(sessionManager).toBeTruthy();

    process.env.VOICE_PROVIDER = originalProvider;
    process.env.VOICE_USE_UV = originalUseUv;
  });

  it.skipIf(!hasPythonDeps)("should initialize with venv Python", async () => {
    const originalProvider = process.env.VOICE_PROVIDER;
    const originalUseUv = process.env.VOICE_USE_UV;

    process.env.VOICE_PROVIDER = "maya1";
    process.env.VOICE_USE_UV = "false";
    process.env.WHISPER_MODEL_PATH = "large-v3-turbo";
    process.env.PIPER_MODEL_PATH = "./packages/voice/models/piper";

    await initializeVoicePools();

    const { sttPool, ttsPool, sessionManager } = getVoicePools();
    expect(sttPool).toBeTruthy();
    expect(ttsPool).toBeTruthy();
    expect(sessionManager).toBeTruthy();

    process.env.VOICE_PROVIDER = originalProvider;
    process.env.VOICE_USE_UV = originalUseUv;
  });

  it.skipIf(!hasPythonDeps)(
    "should verify dependencies before initialization",
    async () => {
      const originalProvider = process.env.VOICE_PROVIDER;
      const originalUseUv = process.env.VOICE_USE_UV;

      process.env.VOICE_PROVIDER = "maya1";
      process.env.VOICE_USE_UV = "false";
      process.env.WHISPER_MODEL_PATH = "large-v3-turbo";
      process.env.PIPER_MODEL_PATH = "./packages/voice/models/piper";
      process.env.PYTHON_PATH = "/nonexistent/python"; // Invalid Python path

      // Should fail with helpful error
      await expect(initializeVoicePools()).rejects.toThrow();

      process.env.VOICE_PROVIDER = originalProvider;
      process.env.VOICE_USE_UV = originalUseUv;
      process.env.PYTHON_PATH = undefined;
    }
  );
});
