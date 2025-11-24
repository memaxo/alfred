import { afterAll, describe, expect, it } from "bun:test";
import type { ServerWebSocket } from "bun";
import { VoiceRegistry } from "../../src/server/registry";
import {
  VoiceSocketHandler,
  type VoiceSocketHooks,
} from "../../src/server/socket";
import { VoiceStreamClient } from "../../src/stream";

// Mock dependencies
const mockHooks: VoiceSocketHooks = {
  onSessionStart: async () => "reg-1",
  onSessionStatus: async () => {},
  onTranscriptUpdate: async () => {},
  onAssistantResponse: async () => {},
  onSessionError: async () => {},
  onSessionComplete: async () => {},
  runAssistant: async () => ({ text: "ok" }),
};

// Mock pools with slight delay to simulate work
const mockSttPool = {
  transcribe: async () => {
    await new Promise((r) => setTimeout(r, 10));
    return { text: "hello", isPartial: true };
  },
};

const mockTtsPool = {
  synthesize: async (req: any, onChunk: any) => {
    // Simulate synthesis delay
    await new Promise((r) => setTimeout(r, 10));
    if (req.streaming && onChunk) {
      onChunk({ audioBase64: "dGVzdA==", mimeType: "audio/pcm" });
    }
  },
};

const registry = new VoiceRegistry(mockSttPool as any, mockTtsPool as any);
const handler = new VoiceSocketHandler(registry, mockHooks);

const PORT = 8899;
const server = Bun.serve({
  port: PORT,
  websocket: {
    open(ws) {
      ws.data = { userId: "bench-user", lastActivity: Date.now() };
    },
    async message(ws, message) {
      await handler.handleMessage(
        ws as unknown as ServerWebSocket<any>,
        message
      );
    },
  },
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("ok");
  },
});

describe("Latency Benchmark", () => {
  afterAll(() => {
    server.stop();
    registry.shutdown();
  });

  it("measures round trip latency", async () => {
    const client = new VoiceStreamClient({ url: `ws://localhost:${PORT}` });

    const _start = performance.now();
    await client.startSession({ language: "en" });
    const _connected = performance.now();

    const _chunksSent = 0;
    const _firstChunkAck = 0;

    const _chunkPromise = new Promise<void>((_resolve) => {
      // We can't easily hook into client private handler, so we rely on server logs or side effects?
      // Actually, VoiceStreamClient accepts handlers!
    });

    // Re-instantiate with handlers
    await client.close();

    let transcriptReceived = 0;
    const client2 = new VoiceStreamClient(
      { url: `ws://localhost:${PORT}` },
      {
        onPartialTranscript: (ev) => {
          // console.log("Got transcript:", ev);
          transcriptReceived = performance.now();
        },
        onError: (err) => {
          console.error("Client error:", err);
        },
      }
    );

    await client2.startSession();

    const sendTime = performance.now();
    // Send 20ms of audio (320 bytes for 16kHz 16-bit mono)
    const audio = new Uint8Array(320);
    await client2.sendAudioChunk({
      audioBase64: Buffer.from(audio).toString("base64"),
      mimeType: "audio/pcm",
      emitPartial: true, // Explicitly request partial
    });

    // Wait for transcript
    let loops = 0;
    while (transcriptReceived === 0 && performance.now() - sendTime < 2000) {
      await new Promise((r) => setTimeout(r, 10));
      loops++;
    }
    // console.log("Loops waited:", loops);

    if (transcriptReceived > 0) {
      expect(transcriptReceived - sendTime).toBeLessThan(50); // Expect < 50ms for local loopback + 10ms inference
    } else {
      throw new Error("Timeout waiting for transcript");
    }

    await client2.close();
  });
});
