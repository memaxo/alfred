import { type ServerWebSocket } from "bun";
import { afterAll, describe, expect, it } from "bun:test";

import { VoiceRegistry } from "../../src/server/registry";
import {
  VoiceSocketHandler,
  type VoiceSocketHooks,
} from "../../src/server/socket";
import { VoiceStreamClient } from "../../src/stream";

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error("percentile_empty");
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) {
    return sorted[low] ?? sorted.at(-1) ?? 0;
  }
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? lowValue;
  const t = rank - low;
  return lowValue + (highValue - lowValue) * t;
}

// Mock dependencies
const mockHooks: VoiceSocketHooks = {
  onAssistantResponse: async () => {},
  onSessionComplete: async () => {},
  onSessionError: async () => {},
  onSessionStart: async () => "reg-1",
  onSessionStatus: async () => {},
  onTranscriptUpdate: async () => {},
  runAssistant: async () => ({ text: "ok" }),
};

// Mock pools with slight delay to simulate work
const mockSttPool = {
  transcribe: async () => {
    await new Promise((r) => setTimeout(r, 10));
    return { isPartial: true, text: "hello" };
  },
};

const mockTtsPool = {
  // oxlint-disable noExplicitAny: Mock pool requires flexible typing
  synthesize: async (req: any, onChunk: any) => {
    // Simulate synthesis delay
    await new Promise((r) => setTimeout(r, 10));
    if (req.streaming && onChunk) {
      onChunk({ audioBase64: "dGVzdA==", mimeType: "audio/pcm" });
    }
  },
};

// oxlint-disable noExplicitAny: Mock pool cast
const registry = new VoiceRegistry(mockSttPool as any, mockTtsPool as any);
const handler = new VoiceSocketHandler(registry, mockHooks);

const PORT = 8899;
// oxlint-disable noExplicitAny: Bun.serve requires data type
const server = Bun.serve<any>({
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("ok");
  },
  port: PORT,
  websocket: {
    open(ws) {
      ws.data = { userId: "bench-user", lastActivity: Date.now() };
    },
    async message(ws, message) {
      await handler.handleMessage(
        // oxlint-disable noExplicitAny: WebSocket data cast
        ws as unknown as ServerWebSocket<any>,
        message
      );
    },
  },
});

describe("Latency Benchmark", () => {
  afterAll(() => {
    server.stop();
    registry.shutdown();
  });

  it("measures round trip latency", async () => {
    const oldFfmpegPath = process.env.VOICE_FFMPEG_PATH;
    process.env.VOICE_FFMPEG_PATH = "/__missing__/ffmpeg";
    let resolveNextTranscript: ((timestampMs: number) => void) | null = null;
    try {
      const client = new VoiceStreamClient(
        { url: `ws://localhost:${PORT}` },
        {
          onError: (ev) => {
            throw new Error(`voice_stream_client_error:${ev.message}`);
          },
          onPartialTranscript: (_ev) => {
            if (!resolveNextTranscript) {
              return;
            }
            const resolve = resolveNextTranscript;
            resolveNextTranscript = null;
            resolve(performance.now());
          },
        }
      );

      await client.startSession({ language: "en" });

      const runs = 25;
      const latenciesMs: number[] = [];
      const audio = new Uint8Array(320); // 20ms PCM16 @ 16kHz mono

      for (let i = 0; i < runs; i++) {
        const receivedAt = new Promise<number>((resolve, reject) => {
          resolveNextTranscript = resolve;
          setTimeout(() => {
            if (resolveNextTranscript === resolve) {
              resolveNextTranscript = null;
              reject(new Error("timeout_waiting_for_partial_transcript"));
            }
          }, 2000);
        });

        const sendAt = performance.now();
        await client.sendAudioChunk({
          audio,
          emitPartial: true,
          mimeType: "audio/pcm",
        });
        const recvAt = await receivedAt;
        latenciesMs.push(recvAt - sendAt);
      }

      const p50 = percentile(latenciesMs, 50);
      const p95 = percentile(latenciesMs, 95);

      // Local loopback + mocked 10ms "inference" should be comfortably below 50ms.
      expect(p95).toBeLessThan(50);
      expect(p50).toBeLessThan(35);

      await client.close();
    } finally {
      if (oldFfmpegPath === undefined) {
        // oxlint-disable noDelete: test cleanup
        delete process.env.VOICE_FFMPEG_PATH;
      } else {
        process.env.VOICE_FFMPEG_PATH = oldFfmpegPath;
      }
    }
  });
});
