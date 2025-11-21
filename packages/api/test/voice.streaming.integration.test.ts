import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { startVoiceStreamingPrototype, stopVoiceStreamingPrototype } from "../src/voice/streaming";
import { initializeVoicePools, shutdownVoicePools } from "../src/voice/pools";

// Mock auth
mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "test-user", role: "user" }, session: { id: "test-session" } }),
    },
  },
}));

// Mock policies
mock.module("@alfred/policy", () => ({
  evaluate: async () => ({ allow: true }),
}));

// Mock agent to avoid OpenAI requirement
mock.module("@alfred/agent", () => ({
  getAssistantAgentDefaults: () => ({
    tools: {},
    model: "test-model",
    instructions: "system",
  }),
}));

// Mock dependencies that require native modules or external services
mock.module("node-pty", () => ({}));
mock.module("@alfred/db", () => ({
  userRepo: { getPreferences: async () => [] }
}));

describe("voice streaming integration", () => {
  beforeAll(async () => {
    process.env.OPENAI_API_KEY = "dummy"; // Satisfy any other checks
    process.env.VOICE_PROVIDER = "local";
    process.env.VOICE_STREAMING_PROTO = "1";
    process.env.VOICE_STREAMING_PORT = "8799";
    
    // Mock the pools to avoid spawning actual processes during tests
    // This mocks the internals of getVoicePools via module mocking in beforeAll
    mock.module("@alfred/voice/process/stt_pool", () => ({
      STTPool: class {
        start() {}
        stop() {}
        initialize() { return Promise.resolve(); }
        shutdown() { return Promise.resolve(); }
        transcribe() { return Promise.resolve({ text: "" }); }
      },
      ProcessConfig: {} as any,
    }));

    mock.module("@alfred/voice/process/tts_pool", () => ({
      TTSPool: class {
        start() {}
        stop() {}
        initialize() { return Promise.resolve(); }
        shutdown() { return Promise.resolve(); }
        synthesize() { return Promise.resolve(new Uint8Array()); }
      },
    }));

    await initializeVoicePools();
    startVoiceStreamingPrototype();
  });

  afterAll(async () => {
    stopVoiceStreamingPrototype();
    await shutdownVoicePools();
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
        if (msg.type === "ready") return;
        
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
