import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { installVoiceTestPools } from "@alfred/test-kit/voice/runtime-fixture";

// Install stable, full-surface stubs to prevent cross-test module conflicts.
import "./utils/mock-db-client";
import "./utils/agent-mock";

// Remove static imports to allow mocking
// import { startVoiceStreamingPrototype, stopVoiceStreamingPrototype } from "../src/voice/streaming";
// import { initializeVoicePools, shutdownVoicePools } from "../src/voice/pools";

// Mock auth
mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: "test-user", role: "user" },
        session: { id: "test-session" },
      }),
    },
  },
}));

// Mock policies
mock.module("@alfred/policy", () => ({
  evaluate: async () => ({ allow: true, obligations: [] }),
  registerCacheObs: () => {},
}));

// Mock dependencies that require native modules or external services
mock.module("node-pty", () => ({}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));


type VoiceFixtureHandle = Awaited<ReturnType<typeof installVoiceTestPools>>;

describe("voice streaming integration", () => {
  let startVoiceStreamingPrototype: any;
  let stopVoiceStreamingPrototype: any;
  let initializeVoicePools: any;
  let shutdownVoicePools: any;
  let voiceFixture: VoiceFixtureHandle | null = null;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = "dummy"; // Satisfy any other checks
    process.env.VOICE_PROVIDER = "maya1";
    process.env.VOICE_STREAMING_PROTO = "1";
    process.env.VOICE_STREAMING_PORT = "8799";

    voiceFixture = await installVoiceTestPools({
      transcript: "mock transcript",
      chunkText: "stream-chunk",
    });

    const streaming = await import("@alfred/api/voice/streaming");
    startVoiceStreamingPrototype = streaming.startVoiceStreamingPrototype;
    stopVoiceStreamingPrototype = streaming.stopVoiceStreamingPrototype;

    const pools = await import("@alfred/api/voice/pools");
    initializeVoicePools = pools.initializeVoicePools;
    shutdownVoicePools = pools.shutdownVoicePools;

    await initializeVoicePools();
    startVoiceStreamingPrototype();
  });

  afterAll(async () => {
    stopVoiceStreamingPrototype();
    await shutdownVoicePools();
    voiceFixture?.restore();
  });

  it("connects and handles start/stop", async () => {
    const ws = new WebSocket("ws://localhost:8799/voice/stream");

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Test timed out"));
      }, 5000);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", language: "en" }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "ready") {
          return;
        }

        if (msg.type === "session_started") {
          expect(msg.sessionId).toBeDefined();
          ws.send(JSON.stringify({ type: "stop" }));
        }

        if (msg.type === "final_transcript") {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message || "unknown"}`));
      };
    });
  });
});
