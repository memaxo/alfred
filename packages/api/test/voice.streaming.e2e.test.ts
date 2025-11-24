import { afterAll, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { Buffer } from "node:buffer";

// Define mocks BEFORE any imports
mock.module("@discordjs/opus", () => ({
  OpusEncoder: class {
    encode(_buffer: any) {
      return Buffer.from([]);
    }
    decode(_buffer: any) {
      return Buffer.from([]);
    }
  },
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "test-user" },
        session: { id: "test-session" },
      }),
    },
  },
}));

mock.module("@alfred/agent", () => ({
  getOpenAI: vi.fn(() => ({
    chat: vi.fn(() => ({ id: "mock-model" })),
  })),
  getModelId: vi.fn(() => "mock-model"),
  buildAssistantTools: vi.fn(() => ({})),
  buildOrchestratorTools: vi.fn(() => ({})),
  buildTools: vi.fn(() => ({})),
  getAssistantAgentDefaults: vi.fn(() => ({
    model: { id: "assistant-model", modelId: "assistant-model" },
    tools: {},
    stopWhen: vi.fn(),
    prepareStep: vi.fn(),
  })),
  getOrchestratorAgentDefaults: vi.fn(() => ({
    model: { id: "orchestrator-model", modelId: "orchestrator-model" },
    tools: {},
    stopWhen: vi.fn(),
    prepareStep: vi.fn(),
  })),
  wrapLegacyToolToAISDK: vi.fn(),
  registerCodexExecCounter: vi.fn(),
  registerCodexExecHistogram: vi.fn(),
  registerCodexErrorCounter: vi.fn(),
  recordCodexExecRun: vi.fn(),
  recordCodexError: vi.fn(),
  registerAssistantToolCounter: vi.fn(),
  registerAssistantEscalationCounter: vi.fn(),
  recordAssistantToolCall: vi.fn(),
  recordAssistantEscalation: vi.fn(),
  recordMemoryUpdate: vi.fn(),
  recordMemoryForget: vi.fn(),
}));

// Set env vars
process.env.OPENAI_API_KEY = "test-key";
process.env.VOICE_STREAMING_PORT = "8799";
process.env.VOICE_PROVIDER = "maya1";
process.env.VOICE_STREAMING_PROTO = "1";

// Mock pools directly to bypass all process logic
const mockSTTPool = {
  start: vi.fn(),
  stop: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  transcribe: vi
    .fn()
    .mockResolvedValue({ text: "Hello world", language: "en" }),
  activeCount: 0,
  size: 1,
};

const mockTTSPool = {
  start: vi.fn(),
  stop: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  synthesize: vi.fn().mockImplementation(async (req: any, onChunk: any) => {
    if (req.streaming && onChunk) {
      onChunk({ audioBase64: "chunk1", mimeType: "audio/pcm" });
      onChunk({ audioBase64: "chunk2", mimeType: "audio/pcm" });
    }
    return { audioBase64: "full", mimeType: "audio/pcm" };
  }),
  activeCount: 0,
  size: 1,
};

const sessions = new Map();
const mockSessionManager = {
  createSession: vi.fn((_uid, sid, _lang) => {
    const session = {
      id: sid,
      processAudioChunk: vi.fn().mockResolvedValue({ vadConfidence: 0.9 }),
      getTranscript: vi.fn().mockReturnValue("Hello world"),
      clearTranscript: vi.fn(),
      streamSynthesis: vi.fn(async (_text, _voice, cb) => {
        await cb(Buffer.from("chunk1", "base64"));
        await cb(Buffer.from("chunk2", "base64"));
      }),
    };
    sessions.set(sid, session);
    return session;
  }),
  removeSession: vi.fn((sid) => sessions.delete(sid)),
  getSession: vi.fn((sid) => sessions.get(sid)),
  updateSession: vi.fn(),
  handleAudioChunk: vi.fn(),
};

mock.module("../src/voice/pools", () => ({
  getVoicePools: () => ({
    sttPool: mockSTTPool,
    ttsPool: mockTTSPool,
    sessionManager: mockSessionManager,
  }),
  initializeVoicePools: vi.fn().mockResolvedValue(undefined),
  shutdownVoicePools: vi.fn().mockResolvedValue(undefined),
}));

import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";
// import "./utils/mock-voice"; // No longer needed
import "./utils/mock-node-pty"; // Loads mocked node-pty

setupTestEnv();
mockPolicyAudit();

// Stub Agent generate logic
mock.module("../src/ai/generate", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Hello world" }),
  persistResult: vi.fn().mockResolvedValue("replay-id"),
}));

// Import real modules (they will use the mocks above)
// import {
//   startVoiceStreamingPrototype,
//   stopVoiceStreamingPrototype,
// } from "../src/voice/streaming";

// We need a client WebSocket to test the server
const PORT = 8799;
process.env.VOICE_STREAMING_PORT = String(PORT);
process.env.VOICE_PROVIDER = "maya1";
process.env.VOICE_STREAMING_PROTO = "1";

let wsClient: WebSocket;
let startVoiceStreamingPrototype: any;
let stopVoiceStreamingPrototype: any;

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
    }
    ws.onopen = () => {
      resolve();
    };
    ws.onerror = (err) => {
      reject(err);
    };
  });
}

function waitForMessage(ws: WebSocket, type: string): Promise<any> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === type) {
          ws.removeEventListener("message", handler);
          resolve(data);
        }
      } catch (_e) {
        // Ignore
      }
    };
    ws.addEventListener("message", handler);
  });
}

function waitForBinary(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        ws.removeEventListener("message", handler);
        resolve(event.data);
      }
    };
    ws.addEventListener("message", handler);
  });
}

describe("voice streaming e2e", () => {
  beforeAll(async () => {
    // Initialize pools (using mocks)
    const { initializeVoicePools } = await import("../src/voice/pools");
    await initializeVoicePools();

    // Import streaming module dynamically
    const streaming = await import("../src/voice/streaming");
    startVoiceStreamingPrototype = streaming.startVoiceStreamingPrototype;
    stopVoiceStreamingPrototype = streaming.stopVoiceStreamingPrototype;

    // Start server
    startVoiceStreamingPrototype();
  });

  afterAll(() => {
    if (stopVoiceStreamingPrototype) {
      stopVoiceStreamingPrototype();
    }
  });

  it("handles full session lifecycle: start -> audio -> stop -> playback", async () => {
    wsClient = new WebSocket(`ws://localhost:${PORT}/voice/stream`, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    await waitForOpen(wsClient);

    // Expect 'ready'
    const ready = await waitForMessage(wsClient, "ready");
    expect(ready).toBeDefined();

    // 2. Start Session
    wsClient.send(
      JSON.stringify({
        type: "start",
        language: "en",
        codec: "pcm",
        autoStop: true,
      })
    );

    const started = await waitForMessage(wsClient, "session_started");
    expect(started.sessionId).toBeDefined();
    const sessionId = started.sessionId;

    // 3. Send Audio Chunk
    const audioBase64 = Buffer.from(new Float32Array(1600).buffer).toString(
      "base64"
    ); // 0.1s of silence/audio
    wsClient.send(
      JSON.stringify({
        type: "audio_chunk",
        audioBase64,
        mimeType: "audio/pcm",
      })
    );

    // 4. Stop Session (Manual)
    wsClient.send(
      JSON.stringify({
        type: "stop",
      })
    );

    // Expect final transcript
    const finalTx = await waitForMessage(wsClient, "final_transcript");
    expect(finalTx.sessionId).toBe(sessionId);

    // Expect assistant message (generated from mock)
    const assistantMsg = await waitForMessage(wsClient, "assistant_message");
    expect(assistantMsg.text).toBe("Hello world");

    // Expect TTS chunks (mocked TTSPool emits 2 chunks)
    // NOTE: TTS chunks are now binary and JSON events are commented out in socket.ts
    // We need to wait for binary data.
    // const chunk1 = await waitForMessage(wsClient, "tts_chunk");
    // expect(chunk1.sessionId).toBe(sessionId);

    const chunk1 = await waitForBinary(wsClient);
    expect(chunk1).toBeDefined();

    const chunk2 = await waitForBinary(wsClient);
    expect(chunk2).toBeDefined();

    // Expect TTS complete
    const complete = await waitForMessage(wsClient, "tts_complete");
    expect(complete.sessionId).toBe(sessionId);

    wsClient.close();
  });
});
