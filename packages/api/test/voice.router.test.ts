import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller } from "./utils/trpc";
import { mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

process.env.OPENAI_API_KEY = "test-key";

const recordVoiceSttMock = vi.fn();
const recordVoiceTtsMock = vi.fn();

mock.module("@alfred/api/metrics", () => ({
  recordVoiceStt: recordVoiceSttMock,
  recordVoiceTts: recordVoiceTtsMock,
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
  describe("stt", () => {
    it("transcribes audio", async () => {
      const mockResponse = {
        text: "hello world",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const audioBase64 = Buffer.from("test audio").toString("base64");
      const result = await caller.voice.stt({
        audioBase64,
        mimeType: "audio/webm",
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toMatchObject({
        text: "hello world",
      });
    });

    it("validates audio size", async () => {
      const largeAudio = Buffer.alloc(6 * 1024 * 1024).toString("base64");

      await expect(
        caller.voice.stt({
          audioBase64: largeAudio,
          mimeType: "audio/webm",
        })
      ).rejects.toThrow();
    });
  });

  describe("tts", () => {
    it("synthesizes speech", async () => {
      const mockAudio = Buffer.from("audio data");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockAudio.buffer,
      } as any);

      const result = await caller.voice.tts({
        text: "hello world",
        voice: "alloy",
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toHaveProperty("audioBase64");
    });

    it("validates text length", async () => {
      const longText = "a".repeat(601);

      await expect(
        caller.voice.tts({
          text: longText,
        })
      ).rejects.toThrow();
    });
  });
});

