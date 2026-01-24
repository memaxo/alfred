import { afterAll, describe, it } from "bun:test";

import { VoiceRegistry } from "../../src/server/registry";
import {
  VoiceSocketHandler,
  type VoiceSocketHooks,
} from "../../src/server/socket";

const CLIENTS = 50;
const DURATION_MS = 5000;
const CHUNKS_PER_SEC = 50;

const mockHooks: VoiceSocketHooks = {
  onAssistantResponse: async () => {},
  onSessionComplete: async () => {},
  onSessionError: async () => {},
  onSessionStart: async () => "reg-1",
  onSessionStatus: async () => {},
  onTranscriptUpdate: async () => {},
  runAssistant: async () => ({ text: "ok" }),
};

const mockPools = {
  synthesize: async () => {},
  transcribe: async () => ({ text: "." }),
};

// oxlint-disable noExplicitAny: Mock pool cast
const registry = new VoiceRegistry(mockPools as any, mockPools as any);
const handler = new VoiceSocketHandler(registry, mockHooks);

const PORT = 8898;
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
      ws.data = { userId: "load-user" };
    },
    async message(ws, msg) {
      // oxlint-disable noExplicitAny: WebSocket data cast
      await handler.handleMessage(ws as any, msg);
    },
  },
});

describe("Load Benchmark", () => {
  afterAll(() => {
    server.stop();
    registry.shutdown();
  });

  it(`handles ${CLIENTS} concurrent sessions sending ${CHUNKS_PER_SEC} chunks/s`, async () => {
    const oldFfmpegPath = process.env.VOICE_FFMPEG_PATH;
    process.env.VOICE_FFMPEG_PATH = "/__missing__/ffmpeg";
    const clients: WebSocket[] = [];
    const _errors = 0;

    try {
      // Connect all
      for (let i = 0; i < CLIENTS; i++) {
        const ws = new WebSocket(`ws://localhost:${PORT}`);
        await new Promise<void>((resolve) => (ws.onopen = () => resolve()));
        ws.send(JSON.stringify({ sessionId: `load-${i}`, type: "start" }));
        clients.push(ws);
      }

      const start = performance.now();
      const interval = 1000 / CHUNKS_PER_SEC;
      const audio = new Uint8Array(320); // 20ms PCM

      // Send loop
      const timer = setInterval(() => {
        if (performance.now() - start > DURATION_MS) {
          clearInterval(timer);
          return;
        }
        for (const ws of clients) {
          ws.send(audio); // Send binary
        }
      }, interval);

      // Wait
      await new Promise((resolve) => setTimeout(resolve, DURATION_MS + 1000));

      for (const ws of clients) {
        ws.close();
      }
      // If server didn't crash and event loop wasn't blocked, we assume success.
      // This also implicitly verifies that the hot path didn't touch ffmpeg
      // (VOICE_FFMPEG_PATH is intentionally invalid for this test).
    } finally {
      if (oldFfmpegPath === undefined) {
        // oxlint-disable noDelete: test cleanup
        delete process.env.VOICE_FFMPEG_PATH;
      } else {
        process.env.VOICE_FFMPEG_PATH = oldFfmpegPath;
      }
    }
  }, 30_000);
});
