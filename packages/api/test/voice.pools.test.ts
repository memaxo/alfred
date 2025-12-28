import { describe, expect, mock, test } from "bun:test";

// SKIP: This test requires fresh module state (expects pools to not be initialized),
// but mock.module() pollution from other tests causes the pools to already be
// initialized when this test runs. The test passes in isolation.
// TODO: Refactor to use dependency injection instead of relying on module state.
describe("voice pools initialization", () => {
  test("is awaitable and concurrency-safe", async () => {
    let sttCtor = 0;
    let sttInit = 0;
    let ttsCtor = 0;
    let ttsInit = 0;
    let regCtor = 0;

    mock.module("@alfred/voice/process/stt", () => ({
      STTPool: class {
        constructor() {
          sttCtor++;
        }
        get size() {
          return 1;
        }
        get activeCount() {
          return 0;
        }
        async initialize() {
          sttInit++;
          await new Promise((r) => setTimeout(r, 10));
        }
        async shutdown() {}
      },
    }));

    mock.module("@alfred/voice/process/tts", () => ({
      TTSPool: class {
        constructor() {
          ttsCtor++;
        }
        get size() {
          return 1;
        }
        get activeCount() {
          return 0;
        }
        async initialize() {
          ttsInit++;
          await new Promise((r) => setTimeout(r, 10));
        }
        async shutdown() {}
      },
    }));

    mock.module("../src/voice/session", () => ({
      VoiceRegistry: class {
        constructor() {
          regCtor++;
        }
        shutdown() {}
      },
    }));

    process.env.VOICE_PROVIDER = "maya1";
    process.env.WHISPER_DEVICE = "mps";
    process.env.VOICE_STT_POOL_SIZE = "1";
    process.env.VOICE_TTS_POOL_SIZE = "1";

    const { initializeVoicePools, getVoicePools, shutdownVoicePools } =
      await import("../src/voice/pools");

    const p1 = initializeVoicePools();
    const p2 = initializeVoicePools();

    expect(() => getVoicePools()).toThrow();
    await Promise.all([p1, p2]);

    expect(sttCtor).toBe(1);
    expect(ttsCtor).toBe(1);
    expect(regCtor).toBe(1);
    expect(sttInit).toBe(1);
    expect(ttsInit).toBe(1);

    expect(() => getVoicePools()).not.toThrow();
    await shutdownVoicePools();
  });
});
