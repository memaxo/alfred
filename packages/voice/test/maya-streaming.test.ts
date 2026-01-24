import { describe, expect, it, mock } from "bun:test";

import type { Process } from "../src/process/base";

import { Maya } from "../src/process/maya";

describe("Maya Streaming", () => {
  it("should stream audio chunks when streaming is enabled", async () => {
    // Mock Process
    const mockProcess = {
      sendRequest: mock((req, _timeout, onPartial) => {
        // Simulate streaming responses
        if (req.payload.streaming && onPartial) {
          // Emit chunk 1
          onPartial({
            id: req.id,
            type: "audio",
            payload: {
              audioBase64: "chunk1",
              sampleRate: 24_000,
              isFinal: false,
            },
          });

          // Emit chunk 2
          onPartial({
            id: req.id,
            type: "audio",
            payload: {
              audioBase64: "chunk2",
              sampleRate: 24_000,
              isFinal: false,
            },
          });

          // Final response
          return {
            id: req.id,
            type: "audio",
            payload: {
              audioBase64: "",
              sampleRate: 24_000,
              isFinal: true,
            },
          };
        }

        return {
          id: req.id,
          type: "audio",
          payload: {
            audioBase64: "full_audio",
            sampleRate: 24_000,
          },
        };
      }),
    } as unknown as Process;

    const maya = new Maya(mockProcess);
    const chunks: string[] = [];

    const result = await maya.synthesize(
      {
        text: "Hello world",
        streaming: true,
      },
      (chunk) => {
        chunks.push(chunk.audioBase64);
        expect(chunk.mimeType).toBe("audio/pcm");
        expect(chunk.sampleRate).toBe(24_000);
      }
    );

    expect(chunks).toEqual(["chunk1", "chunk2"]);
    // The final response returns the last payload, but usually synthesize returns an aggregate if we structured it that way.
    // In Maya.synthesize:
    // const payloadData = response.payload as ...
    // return { audioBase64: payloadData.audioBase64 ... }
    // If the final payload has empty audioBase64 (as simulated), the result will be empty.
    // This is fine for streaming, as the consumer relies on chunks.
    expect(result.audioBase64).toBe("");
  });
});
