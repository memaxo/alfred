import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock opus BEFORE imports that might use it
// Note: This must be done before any imports that transitively import @discordjs/opus
// The error "Cannot find module ... opus.node" happens when @discordjs/opus is imported
// and tries to load the native binding. We must intercept this.
mock.module("@discordjs/opus", () => ({
  OpusEncoder: class {
    encode(buffer: Buffer) {
      return buffer;
    }
    decode(buffer: Buffer) {
      return buffer;
    }
  },
}));

// Also mock 'opus-script' if used as fallback
mock.module(
  "opus-script",
  () =>
    class {
      encode(buffer: Buffer) {
        return buffer;
      }
      decode(buffer: Buffer) {
        return buffer;
      }
    }
);

import type { ServerWebSocket } from "bun";
import type { VoiceRegistry } from "./registry";
import type {
  VoiceSocketData,
  VoiceSocketHandler,
  VoiceSocketHooks,
} from "./socket";

const { voiceAssistantDurationSeconds, voiceAssistantTotal } = await import(
  "../metrics"
);
const { VoiceSocketHandler: VoiceSocketHandlerCtor } = await import("./socket");

// Mock dependencies
const mockSession = {
  processAudioChunk: mock(async () => ({
    text: "hello",
    vadConfidence: 0.9,
    endOfUtterance: false,
  })),
  getTranscript: mock(() => "hello world"),
  streamSynthesis: mock((_text: string, _voice: string, onChunk: any) => {
    onChunk(Buffer.from("test"));
    return Promise.resolve();
  }),
  clearTranscript: mock(() => {}),
  clearUtterance: mock(() => {}),
  setChunkSize: mock(() => {}),
};

const mockManager = {
  createSession: mock(() => mockSession),
  getSession: mock(() => mockSession),
  removeSession: mock(() => {}),
} as unknown as VoiceRegistry;

const mockHooks: VoiceSocketHooks = {
  onSessionStart: mock(async () => "reg-1"),
  onSessionStatus: mock(async () => {}),
  onTranscriptUpdate: mock(async () => {}),
  onAssistantResponse: mock(async () => {}),
  onSessionError: mock(async () => {}),
  onSessionComplete: mock(async () => {}),
  runAssistant: mock(async () => ({
    text: "assistant reply",
    durationSeconds: 0.3,
  })),
};

function createMockWs(): ServerWebSocket<VoiceSocketData> {
  return {
    data: {
      userId: "user-1",
      lastActivity: 0,
    },
    readyState: 1,
    send: mock(() => 0),
    close: mock(() => {}),
  } as unknown as ServerWebSocket<VoiceSocketData>;
}

describe("VoiceSocketHandler", () => {
  let handler: VoiceSocketHandler;
  let ws: ServerWebSocket<VoiceSocketData>;

  beforeEach(() => {
    voiceAssistantTotal.reset();
    voiceAssistantDurationSeconds.reset();
    handler = new VoiceSocketHandlerCtor(mockManager, mockHooks);
    ws = createMockWs();
    // Reset mocks
    (mockManager.createSession as any).mockClear();
    (mockManager.getSession as any).mockClear();
    (mockManager.removeSession as any).mockClear();
    (mockSession.processAudioChunk as any).mockClear();
    (mockSession.streamSynthesis as any).mockClear();
    (mockHooks.runAssistant as any).mockClear();
  });

  it("should handle 'start' message", async () => {
    const payload = JSON.stringify({
      _: "start",
      sessionId: "sess-1",
      language: "en",
    });
    await handler.handleMessage(ws, payload);

    expect(mockManager.createSession).toHaveBeenCalledWith(
      "user-1",
      "sess-1",
      "en"
    );
    expect(ws.data.sessionId).toBe("sess-1");
    expect(ws.send).toHaveBeenCalled(); // Ready/Status messages
    const sent = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    expect(sent.some((m: any) => m._ === "session_started")).toBe(true);
  });

  it("should handle 'audio_chunk' message", async () => {
    // Setup session state first
    ws.data.sessionId = "sess-1";

    const payload = JSON.stringify({
      _: "audio_chunk",
      audioBase64: "dGVzdA==", // "test"
    });
    await handler.handleMessage(ws, payload);

    expect(mockSession.processAudioChunk).toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled(); // VAD state / Partial transcript
  });

  it("should handle binary audio message", async () => {
    ws.data.sessionId = "sess-1";
    ws.data.codec = "pcm";
    ws.data.inputMimeType = "audio/raw;codec=pcm_s16le;rate=16000";

    const bytes = new TextEncoder().encode("test-audio");
    await handler.handleMessage(ws, bytes);

    expect(mockSession.processAudioChunk).toHaveBeenCalled();
    // Internally converts buffer to base64
    expect(mockSession.processAudioChunk).toHaveBeenCalledWith(
      Buffer.from(bytes).toString("base64"),
      "audio/raw;codec=pcm_s16le;rate=16000",
      expect.any(Object)
    );
  });

  it("should handle 'stop' message", async () => {
    ws.data.sessionId = "sess-1";
    ws.data.sessionRegistryId = "reg-1";

    const payload = JSON.stringify({ _: "stop" });
    await handler.handleMessage(ws, payload);

    expect(mockHooks.runAssistant).toHaveBeenCalledWith(
      "user-1",
      "hello world",
      undefined
    );
    expect(mockSession.streamSynthesis).toHaveBeenCalled();

    // Verify sequence of messages
    const sent = (ws.send as any).mock.calls.map((c: any) => {
      if (c[0] instanceof Buffer || c[0] instanceof Uint8Array) {
        return { _: "tts_chunk_binary" };
      }
      return JSON.parse(c[0]);
    });
    expect(sent.some((m: any) => m._ === "final_transcript")).toBe(true);
    expect(sent.some((m: any) => m._ === "assistant_message")).toBe(true);
    expect(sent.some((m: any) => m._ === "tts_chunk_binary")).toBe(true);
    expect(sent.some((m: any) => m._ === "tts_complete")).toBe(true);

    const metric = await voiceAssistantDurationSeconds.get();
    const count =
      metric.values.find((v) => {
        const name = v.metricName;
        return typeof name === "string" && name.endsWith("_count");
      })?.value ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it("should allow a new utterance after stop (session reuse + cache clear)", async () => {
    // Start session
    await handler.handleMessage(
      ws,
      JSON.stringify({ _: "start", sessionId: "sess-1", language: "en" })
    );

    // First chunk should request cache clear (fresh session)
    await handler.handleMessage(
      ws,
      JSON.stringify({
        _: "audio_chunk",
        audioBase64: "dGVzdA==",
        mimeType: "audio/pcm",
      })
    );
    expect(mockSession.processAudioChunk).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ clearCache: true })
    );

    // Stop (finalize utterance)
    await handler.handleMessage(ws, JSON.stringify({ _: "stop" }));
    expect(mockSession.clearUtterance).toHaveBeenCalled();

    // Next chunk should again request cache clear (new utterance)
    await handler.handleMessage(
      ws,
      JSON.stringify({
        _: "audio_chunk",
        audioBase64: "dGVzdA==",
        mimeType: "audio/pcm",
      })
    );
    expect(mockSession.processAudioChunk).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ clearCache: true })
    );
  });

  it("rejects binary audio before start", async () => {
    const bytes = new TextEncoder().encode("test-audio");
    await handler.handleMessage(ws, bytes);

    expect(mockSession.processAudioChunk).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled();
    const sent = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    expect(sent.some((m: any) => m._ === "error")).toBe(true);
  });

  it("rejects binary audio when inputMimeType is missing", async () => {
    ws.data.sessionId = "sess-1";
    const bytes = new TextEncoder().encode("test-audio");
    await handler.handleMessage(ws, bytes);

    expect(mockSession.processAudioChunk).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled();
    const sent = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    expect(sent.some((m: any) => m._ === "error")).toBe(true);
  });

  it("rejects oversized binary audio payloads", async () => {
    ws.data.sessionId = "sess-1";
    ws.data.codec = "pcm";
    ws.data.inputMimeType = "audio/raw;codec=pcm_s16le;rate=16000";

    const bytes = new Uint8Array(70_000);
    await handler.handleMessage(ws, bytes);

    expect(mockSession.processAudioChunk).not.toHaveBeenCalled();
    const sent = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    expect(sent.some((m: any) => m._ === "error")).toBe(true);
  });

  it("interrupts TTS (barge-in) when audio arrives during playback", async () => {
    ws.data.sessionId = "sess-1";
    ws.data.sessionRegistryId = "reg-1";
    ws.data.codec = "pcm";
    ws.data.inputMimeType = "audio/raw;codec=pcm_s16le;rate=16000";
    ws.data.ttsInProgress = true;
    ws.data.ttsAbortToken = 0;

    const payload = JSON.stringify({
      _: "audio_chunk",
      audioBase64: "dGVzdA==",
      mimeType: "audio/raw;codec=pcm_s16le;rate=16000",
    });
    await handler.handleMessage(ws, payload);

    const sent = (ws.send as any).mock.calls.map((c: any) => {
      if (c[0] instanceof Buffer || c[0] instanceof Uint8Array) {
        return { _: "binary" };
      }
      return JSON.parse(c[0]);
    });
    expect(sent.some((m: any) => m._ === "interrupt")).toBe(true);
    expect(ws.data.ttsAbortToken).toBe(1);
  });
});
