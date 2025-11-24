import { describe, expect, it, mock } from "bun:test";
import { STTPool, type STTRequest } from "../src/process/stt";

// Mock the entire Process module
mock.module("../src/process/base", () => {
  return {
    Process: class MockProcess {
      ipc = {
        createRequest: (type: string, payload: unknown) => ({ type, payload }),
      };
      async start() {}
      async sendRequest(req: any) {
        if (req.payload.streaming) {
          // For verification of interface only - STT streaming is usually via VAD chunking
          // which sends separate requests for each chunk, OR a single long-running request.
          // The current STT implementation seems to be request-response (transcribe a chunk).
          // True streaming (websocket style) isn't implemented in the pool yet, it relies on client chunking.
          return {
            type: "transcript",
            payload: {
              text: "streaming result",
              isPartial: true,
            },
          };
        }
        return {
          type: "transcript",
          payload: {
            text: "test transcription",
            isPartial: false,
          },
        };
      }
      async shutdown() {}
      getHealth() {
        return { isHealthy: true };
      }
    },
  };
});

describe("STT Streaming Verification", () => {
  it("should support streaming flags in request", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    const request: STTRequest = {
      audioBase64: "test",
      mimeType: "audio/pcm",
      streaming: true,
    };

    const result = await pool.transcribe(request);
    expect(result.text).toBe("streaming result");
    expect(result.isPartial).toBe(true);
  });
});
