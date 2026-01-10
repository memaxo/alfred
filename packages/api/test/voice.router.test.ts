import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

process.env.OPENAI_API_KEY = "test-key";

const transcribeLocalMock = vi.fn();
mock.module("@alfred/voice/services/stt", () => ({
  transcribeLocal: transcribeLocalMock,
}));

const synthesizeLocalMock = vi.fn();
mock.module("@alfred/voice/services/tts", () => ({
  synthesizeLocal: synthesizeLocalMock,
}));

mock.module("../src/voice/pools", () => ({
  getVoicePools: () => ({
    sttPool: {},
    ttsPool: {},
    voiceRegistry: {},
  }),
  initializeVoicePools: async () => {},
  shutdownVoicePools: async () => {},
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["voice.stt", "voice.tts"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("voice router", () => {
  describe("sttTranscribe", () => {
    it("transcribes audio", async () => {
      const mockResponse = {
        text: "hello world",
        model: "parakeet",
      };

      transcribeLocalMock.mockResolvedValue(mockResponse);

      const audioBase64 = Buffer.from("test audio").toString("base64");
      const result = await caller.voice.sttTranscribe({
        audioBase64,
        mimeType: "audio/webm",
      });

      expect(transcribeLocalMock).toHaveBeenCalled();
      expect(result).toMatchObject({
        text: "hello world",
      });
    });
  });

  describe("ttsSynthesize", () => {
    it("synthesizes speech", async () => {
      const mockAudio = {
        audioBase64: Buffer.from("audio data").toString("base64"),
        mimeType: "audio/mp3",
      };

      synthesizeLocalMock.mockResolvedValue(mockAudio);

      const result = await caller.voice.ttsSynthesize({
        text: "hello world",
        voice: "alloy",
      });

      expect(synthesizeLocalMock).toHaveBeenCalled();
      expect(result).toEqual(mockAudio);
    });

    it("validates text length", async () => {
      const longText = "a".repeat(601);

      await expect(
        caller.voice.ttsSynthesize({
          text: longText,
        })
      ).rejects.toThrow();
    });
  });
});
