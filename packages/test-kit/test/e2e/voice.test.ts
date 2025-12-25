import { beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import { ensureFfmpegAvailable } from "@alfred/voice/audio/codec";
import * as config from "@alfred/voice/services/config";
import type { SpeechToSpeechResponse } from "@alfred/voice/types";
import { HardwareProbe } from "../../src/physical/probe";
import { SyntheticSignal } from "../../src/physical/signal";

const SHOULD_RUN = process.env.RUN_LEVEL5_E2E === "1";

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

if (!SHOULD_RUN) {
  describe.skip("Level 5 E2E: Voice Physical Layer (gated)", () => {});
} else {
  describe("Level 5 E2E: Voice Physical Layer", () => {
    let hasGpu = false;

    beforeAll(async () => {
      const caps = await HardwareProbe.check();
      hasGpu = caps.gpu;
      void hasGpu;
    });

    const runIt = hasFfmpeg ? it : it.skip;

    runIt("processes synthetic audio signal", async () => {
      const [{ voiceRouter }, { RuntimeContext }] = await Promise.all([
        import("@alfred/api/routers/voice"),
        import("@alfred/type/runtime-context"),
      ]);

      // 1. Generate Signal (440Hz sine wave, 1 sec)
      const pcmBuffer = SyntheticSignal.sine(440, 1000);
      const audioBase64 = pcmBuffer.toString("base64");

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

      const { encodeFromPCM16 } = await import("@alfred/voice/audio/codec");
      const wavInput = await encodeFromPCM16({
        audioBase64,
        format: "wav",
      });

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

      expect(result.transcript.text).toBe("Synthetic Sine Wave");
      expect(result.audio.mimeType).toBe("audio/mpeg");
      expect(mockStt.transcribe).toHaveBeenCalled();
    });
  });
}
