import { beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import { voiceRouter } from "@alfred/api/routers/voice";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { ensureFfmpegAvailable } from "@alfred/voice/audio/codec";
import * as config from "@alfred/voice/services/config";
import type { SpeechToSpeechResponse } from "@alfred/voice/types";
import { HardwareProbe } from "../../src/physical/probe";
import { SyntheticSignal } from "../../src/physical/signal";

const hasFfmpeg = (() => {
  try {
    ensureFfmpegAvailable();
    return true;
  } catch {
    return false;
  }
})();

// Mock Config
spyOn(config, "getVoiceProvider").mockReturnValue("maya1");

// Mock Policy
mock.module("@alfred/policy", () => ({
  evaluate: async () => ({ allow: true, obligations: [] }),
}));

// Mock DB Policy Repo (Audit Logs)
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));

// Mock Assistant (avoid LLM)
mock.module("@alfred/api/voice/assistant", () => ({
  runAssistantForVoice: async () => ({
    text: "Hello verification",
    replayId: "mock-replay-id",
    raw: { text: "Hello verification" },
    durationSeconds: 0.1,
  }),
}));

describe("Level 5 E2E: Voice Physical Layer", () => {
  let hasGpu = false;

  beforeAll(async () => {
    const caps = await HardwareProbe.check();
    hasGpu = caps.gpu;
    console.log(`[Physical] GPU Available: ${hasGpu}`);
  });

  const runIt = hasFfmpeg ? it : it.skip;

  runIt("processes synthetic audio signal", async () => {
    // 1. Generate Signal (440Hz sine wave, 1 sec)
    const pcmBuffer = SyntheticSignal.sine(440, 1000);
    const audioBase64 = pcmBuffer.toString("base64");

    // 2. Determine Mode (Real vs Mock) based on Hardware
    // For this test, we will MOCK the pools if no GPU, but use REAL Router + Codecs
    // Ideally, if GPU is present, we'd use real pools, but that requires the python server running.
    // The HardwareProbe doesn't start the server, it just checks capabilities.
    // So we will stick to mocking the *Pools* but testing the *Router* logic with real Codec flow.

    // This mirrors `verify-voice-runtime.ts` but inside the TestKit structure
    // and using `SyntheticSignal` instead of hardcoded base64.

    // We need to mock getVoicePools again here or rely on global mocks.
    // Since we are in a new test file, we can mock module imports.

    const mockStt = {
      transcribe: mock(async () => ({
        text: "Synthetic Sine Wave",
        durationSeconds: 1,
      })),
    };
    const mockTts = {
      synthesize: mock(async () => ({
        audioBase64: SyntheticSignal.silence(1000).toString("base64"),
        mimeType: "audio/raw;codec=pcm_s16le;rate=16000",
        sampleRate: 16_000,
      })),
    };

    // We need to mock the POOLS module, not just the return value,
    // because the router imports `getVoicePools` from `@alfred/api/voice/pools`.
    // Bun's mock.module is global and hoisted.
    // We'll do it via a dynamic import or assume the test runner handles it.
    // Actually, `verify-voice-runtime` used `spyOn`. Let's use that pattern.

    const pools = await import("@alfred/api/voice/pools");
    spyOn(pools, "getVoicePools").mockReturnValue({
      sttPool: mockStt as any,
      ttsPool: mockTts as any,
      voiceRegistry: { createSession: mock(), removeSession: mock() } as any,
    });

    // 3. Execute S2S
    const caller = voiceRouter.createCaller({
      session: { user: { id: "test-user" } },
      runtimeContext: new RuntimeContext([
        ["requestId", "voice-e2e"],
        ["scanContext", null],
      ]),
    } as any);

    // The router expects "audio/webm" or similar usually, but we are sending raw PCM?
    // No, `transcribeLocal` in router calls `normalizeLocalSttAudio`.
    // If we send `audio/raw` mime, it might skip ffmpeg decode.
    // Let's send "audio/wav" and wrap the PCM in a WAV header to test codec logic too?
    // OR just test the router's handling of raw PCM if we claim it's something else.

    // Let's assume the client sends WAV (common test case)
    // We can use ffmpeg (via our codec lib) to encode our PCM to WAV first!
    const { encodeFromPCM16 } = await import("@alfred/voice/audio/codec");
    const wavInput = await encodeFromPCM16({
      audioBase64,
      format: "wav",
    });

    // Type assertion: createCaller returns a router caller where speechToSpeech is a mutation
    const speechToSpeech = caller.speechToSpeech as
      | ((input: {
          audioBase64: string;
          mimeType: string;
          ttsFormat: string;
          surface: string;
        }) => Promise<SpeechToSpeechResponse>)
      | undefined;

    if (!speechToSpeech) {
      throw new Error("speechToSpeech procedure not found on voice router");
    }

    const result = await speechToSpeech({
      audioBase64: wavInput.audioBase64,
      mimeType: "audio/wav",
      ttsFormat: "mp3",
      surface: "web",
    });

    console.log("Result Audio:", result.audio);

    // 4. Verify
    expect(result.transcript.text).toBe("Synthetic Sine Wave");
    // Router requested MP3 format
    // MIME type depends on whether ffmpeg/encoder was used or raw PCM returned.
    // `synthesizeLocal` encodes PCM to the requested format, so we expect audio/mpeg.
    // If the MIME ever mismatches, inspect the encode step or pool mock.
    expect(result.audio.mimeType).toBe("audio/mpeg");

    // Verify STT input was processed
    expect(mockStt.transcribe).toHaveBeenCalled();
  });
});
