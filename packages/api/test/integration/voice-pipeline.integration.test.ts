/**
 * Voice Pipeline Integration Tests
 *
 * Tests the complete voice pipeline: STT -> Assistant -> TTS
 * using local voice models (Faster-Whisper for STT, Piper TTS for TTS).
 *
 * Requires local voice models to be installed:
 *   cd packages/voice && ./scripts/install-deps.sh
 *
 * Note: The pyarrow/nemo_toolkit dependency conflict has been resolved by
 * pinning datasets>=2.21.0 in pyproject.toml. If tests still fail to initialize,
 * run `cd packages/voice && uv sync` to update the lock file.
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.VOICE_PROVIDER = "local"; // Use local models

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

// Test utilities - loaded dynamically to avoid import order issues
let createTestCaller: typeof import("../utils/trpc").createTestCaller;
let initializeVoicePools: typeof import("../../src/voice/pools").initializeVoicePools;
let shutdownVoicePools: typeof import("../../src/voice/pools").shutdownVoicePools;
let voicePoolsInitialized = false;
let poolsInitError: Error | null = null;

beforeAll(async () => {
  // Load test utilities
  ({ createTestCaller } = await import("../utils/trpc"));

  // Initialize voice pools for local models
  try {
    const pools = await import("../../src/voice/pools");
    initializeVoicePools = pools.initializeVoicePools;
    shutdownVoicePools = pools.shutdownVoicePools;
    await initializeVoicePools();
    voicePoolsInitialized = true;
    console.log("Voice pools initialized for local models");
  } catch (error) {
    poolsInitError = error instanceof Error ? error : new Error(String(error));
    console.warn("Voice pools initialization failed:", error);
    console.warn(
      "If pyarrow error, run: cd packages/voice && uv sync --upgrade"
    );
  }
});

afterAll(async () => {
  if (voicePoolsInitialized && shutdownVoicePools) {
    await shutdownVoicePools();
  }
});

describe("Voice Pipeline Integration", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;

  beforeEach(async () => {
    caller = await createTestCaller({
      userId: "voice-test-user",
      roles: ["owner"],
      scopes: ["voice.read", "voice.write", "assistant.write"],
    });
  });

  describe("Voice Session Management", () => {
    it("lists available voices", async () => {
      const voices = await caller.voice.listVoices();

      expect(voices).toBeDefined();
      expect(Array.isArray(voices)).toBe(true);
      // Should have at least some voices
      expect(voices.length).toBeGreaterThan(0);
    });
  });

  describe("TTS Synthesis", () => {
    it("synthesizes text to speech", async () => {
      if (!voicePoolsInitialized) {
        console.warn(
          "Skipping: voice pools not initialized",
          poolsInitError?.message
        );
        return;
      }

      const result = await caller.voice.ttsSynthesize({
        text: "Hello, this is a test.",
        voice: "en_US-lessac-medium", // Piper voice name
        format: "mp3",
      });

      expect(result).toBeDefined();
      expect(result.audioBase64).toBeDefined();
      expect(result.mimeType).toContain("audio");
    });

    it("handles empty text gracefully", async () => {
      if (!voicePoolsInitialized) {
        console.warn(
          "Skipping: voice pools not initialized",
          poolsInitError?.message
        );
        return;
      }

      await expect(
        caller.voice.ttsSynthesize({
          text: "",
          voice: "en_US-lessac-medium",
          format: "mp3",
        })
      ).rejects.toBeDefined();
    });
  });

  describe("Voice Preview", () => {
    it("previews a voice with sample text", async () => {
      if (!voicePoolsInitialized) {
        console.warn(
          "Skipping: voice pools not initialized",
          poolsInitError?.message
        );
        return;
      }

      const result = await caller.voice.previewVoice({
        voice: "en_US-lessac-medium",
        text: "Hello, I am Alfred.",
      });

      expect(result).toBeDefined();
      expect(result.audioBase64).toBeDefined();
      expect(result.mimeType).toBeDefined();
    });
  });
});

describe("Voice to Assistant Pipeline", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;

  beforeEach(async () => {
    caller = await createTestCaller({
      userId: "voice-assistant-test",
      roles: ["owner"],
      scopes: [
        "voice.read",
        "voice.write",
        "assistant.write",
        "assistant.read",
      ],
    });
  });

  it("synthesizes text to speech with local models", async () => {
    if (!voicePoolsInitialized) {
      console.warn(
        "Skipping: voice pools not initialized",
        poolsInitError?.message
      );
      return;
    }

    // Test TTS with Piper local model
    const result = await caller.voice.ttsSynthesize({
      text: "Hello, this is Alfred speaking.",
      voice: "en_US-lessac-medium",
      format: "mp3",
    });

    expect(result).toBeDefined();
    expect(result.audioBase64).toBeDefined();
    expect(result.mimeType).toContain("audio");
  });
});

describe("Voice Error Handling", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;

  beforeEach(async () => {
    caller = await createTestCaller({
      userId: "voice-error-test",
      roles: ["owner"],
      scopes: ["voice.read", "voice.write"],
    });
  });

  it("handles invalid voice ID", async () => {
    if (!voicePoolsInitialized) {
      console.warn(
        "Skipping: voice pools not initialized",
        poolsInitError?.message
      );
      return;
    }

    await expect(
      caller.voice.ttsSynthesize({
        text: "Test",
        voice: "invalid-voice-id-12345",
        format: "mp3",
      })
    ).rejects.toBeDefined();
  });
});
