import type { VoiceStreamCodec } from "@alfred/type/voice";
import type { VoiceSession } from "@alfred/voice/server/session";
import type { VoiceStreamClientHandlers } from "@alfred/voice/stream";

import { createVoiceFixture } from "@alfred/test-kit/voice/registry";
import { VoiceStreamClient } from "@alfred/voice/stream";
import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket, { WebSocketServer } from "ws";

// Playwright (Node) does not provide a global WebSocket implementation.
// VoiceStreamClient expects one, so we install the ws implementation globally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).WebSocket = WebSocket;

const STREAM_PORT = Number(process.env.E2E_VOICE_STREAM_PORT ?? 8788);
const STREAM_PATH = "/voice/stream";
const STREAM_URL = `ws://127.0.0.1:${STREAM_PORT}${STREAM_PATH}`;
const AUTH_TOKEN = "Bearer voice-e2e-mock";
// 1500ms is too tight under CI/local load; this test is intentionally end-to-end and
// should be resilient to short scheduling pauses.
const SESSION_TIMEOUT_MS = 5000;
const DEBUG_VOICE = process.env.DEBUG_VOICE_E2E === "1";

type ServerStats = {
  started: number;
  completed: number;
  cleaned: number;
  errors: number;
  ttsChunks: number;
};

type ConnectionState = {
  userId: string;
  connectionId: string;
  sessionId: string | null;
  codec: VoiceStreamCodec;
  voice: string;
  assistantText: string | null;
  lastTranscript: string | null;
  timeoutMs: number;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  voiceSession: VoiceSession | null;
  sequence: number;
  closed: boolean;
};

class MockVoiceStreamingServer {
  private readonly server = createServer();
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly fixturePromise = createVoiceFixture({
    transcript: "Hello from Maya",
    chunkText: "synthetic-chunk",
    streamingChunks: 3,
  });
  private registry: Awaited<ReturnType<typeof createVoiceFixture>> | null =
    null;
  private readonly connections = new Map<WebSocket, ConnectionState>();
  private readonly stats: ServerStats = {
    started: 0,
    completed: 0,
    cleaned: 0,
    errors: 0,
    ttsChunks: 0,
  };

  constructor(private readonly port: number) {
    this.server.on("upgrade", async (req, socket, head) => {
      const url = new URL(req.url ?? "", "http://localhost");
      if (url.pathname !== STREAM_PATH) {
        socket.destroy();
        return;
      }
      try {
        await this.ensureRegistry();
      } catch (error) {
        socket.destroy(error instanceof Error ? error : undefined);
        return;
      }
      if (!this.authorize(req)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.handleConnection(ws, req);
      });
    });
  }

  static async start(port = STREAM_PORT) {
    const server = new MockVoiceStreamingServer(port);
    await server.listen();
    return server;
  }

  async stop() {
    for (const ws of this.connections.keys()) {
      ws.terminate();
    }
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    if (this.registry) {
      this.registry.restore();
      this.registry = null;
    }
  }

  getStats(): ServerStats {
    return { ...this.stats };
  }

  getActiveSessions(): number {
    return Array.from(this.connections.values()).filter(
      (state) => Boolean(state.sessionId) && !state.closed
    ).length;
  }

  private authorize(req: IncomingMessage): boolean {
    return req.headers.authorization === AUTH_TOKEN;
  }

  private async ensureRegistry() {
    if (!this.registry) {
      this.registry = await this.fixturePromise;
    }
    if (DEBUG_VOICE) {
      console.log("[mock-voice] registry ready");
    }
  }

  private listen() {
    return new Promise<void>((resolve) => {
      this.server.listen(this.port, resolve);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const userId =
      req.headers["x-test-user"]?.toString() ?? "voice-e2e-test-user";
    const timeoutHeader = req.headers["x-test-timeout-ms"]?.toString();
    const timeoutOverride = timeoutHeader ? Number(timeoutHeader) : null;
    const timeoutMs =
      typeof timeoutOverride === "number" &&
      Number.isFinite(timeoutOverride) &&
      timeoutOverride > 0 &&
      timeoutOverride <= 120_000
        ? timeoutOverride
        : SESSION_TIMEOUT_MS;
    const state: ConnectionState = {
      userId,
      connectionId: randomUUID(),
      sessionId: null,
      codec: "pcm",
      voice: "alloy",
      assistantText: null,
      lastTranscript: null,
      timeoutMs,
      inactivityTimer: null,
      voiceSession: null,
      sequence: 0,
      closed: false,
    };
    this.connections.set(ws, state);
    if (DEBUG_VOICE) {
      console.log("[mock-voice] connection established", state.connectionId);
    }
    this.send(ws, { _: "ready", sessionId: null });
    ws.on("message", (data, isBinary) => {
      void this.handleMessage(ws, data, Boolean(isBinary));
    });
    ws.once("close", () => {
      this.cleanup(ws);
    });
    this.armTimeout(ws);
  }

  private async handleMessage(
    ws: WebSocket,
    data: WebSocket.RawData,
    isBinary: boolean
  ) {
    const state = this.connections.get(ws);
    if (!state || state.closed) {
      return;
    }
    await this.ensureRegistry();
    this.armTimeout(ws);

    if (
      isBinary &&
      (data instanceof Buffer ||
        data instanceof Uint8Array ||
        data instanceof ArrayBuffer)
    ) {
      await this.handleBinary(ws, data);
      return;
    }

    let payload: Record<string, unknown>;
    try {
      const text =
        typeof data === "string"
          ? data
          : Buffer.from(data as Buffer | Uint8Array).toString("utf8");
      payload = JSON.parse(text);
    } catch {
      this.emitError(ws, "invalid_json", true);
      return;
    }

    const type = typeof payload._ === "string" ? payload._ : null;
    switch (type) {
      case "start":
        await this.handleStart(ws, payload);
        break;
      case "stop":
        await this.handleStop(ws, String(payload.reason ?? "manual"));
        break;
      case "telemetry_report":
        break;
      case null:
        this.emitError(ws, "missing_event_type", true);
        break;
      default:
        this.emitError(ws, `unknown_event:${type}`, false);
    }
  }

  private handleStart(ws: WebSocket, payload: Record<string, unknown>) {
    const state = this.connections.get(ws);
    const registry = this.registry;
    if (!(state && registry)) {
      return;
    }

    const requestedCodec = (payload.codec as VoiceStreamCodec) ?? "pcm";
    state.codec = requestedCodec;
    state.voice = (payload.ttsVoice as string) ?? "alloy";

    if (requestedCodec === "wav") {
      this.emitError(ws, "codec_not_supported", true);
      return;
    }

    const sessionId = (payload.sessionId as string | undefined) ?? randomUUID();
    state.sessionId = sessionId;
    state.voiceSession = registry.registry.createSession(
      state.userId,
      sessionId,
      (payload.language as string | undefined) ?? "en"
    );
    if (DEBUG_VOICE) {
      console.log("[mock-voice] start session", sessionId);
    }

    this.stats.started += 1;
    this.sendStatus(ws, "recording");
    this.send(ws, {
      _: "session_started",
      sessionId,
      codec: requestedCodec,
      negotiatedCodec: requestedCodec,
    });

    if (payload.autoStop === true) {
      setTimeout(() => {
        if (state.closed) {
          return;
        }
        this.send(ws, {
          _: "auto_stop",
          sessionId,
          reason: "silence",
        });
        void this.handleStop(ws, "silence");
      }, 250);
    }
  }

  private async handleBinary(ws: WebSocket, chunk: WebSocket.RawData) {
    const state = this.connections.get(ws);
    if (!state?.voiceSession) {
      if (DEBUG_VOICE) {
        console.log("[mock-voice] ignore binary before start");
      }
      return;
    }
    const payload = {
      type: "audio_chunk",
      mimeType: "audio/pcm",
      emitPartial: true,
      audioBase64: Buffer.from(chunk as Buffer).toString("base64"),
    };
    await this.handleAudioChunk(ws, payload);
  }

  private async handleAudioChunk(
    ws: WebSocket,
    payload: Record<string, unknown>
  ) {
    const state = this.connections.get(ws);
    if (!(state?.voiceSession && state.sessionId)) {
      if (DEBUG_VOICE) {
        console.log("[mock-voice] chunk before start");
      }
      this.emitError(ws, "session_not_started", false);
      return;
    }
    const mimeType =
      typeof payload.mimeType === "string" ? payload.mimeType : "audio/pcm";
    const audioBase64 =
      typeof payload.audioBase64 === "string"
        ? payload.audioBase64
        : Buffer.from(
            (payload.audio as Buffer | ArrayBuffer | Uint8Array) ??
              new Uint8Array()
          ).toString("base64");

    if (!audioBase64) {
      this.emitError(ws, "audio_payload_empty", false);
      return;
    }

    const result = await state.voiceSession.processAudioChunk(
      audioBase64,
      mimeType,
      {
        sessionId: state.sessionId,
      }
    );
    if (result?.text) {
      state.lastTranscript = result.text;
      this.send(ws, {
        _: "partial_transcript",
        sessionId: state.sessionId,
        text: result.text,
      });
    }
  }

  private async handleStop(ws: WebSocket, reason: string) {
    const state = this.connections.get(ws);
    if (!(state?.voiceSession && state.sessionId)) {
      this.emitError(ws, "session_not_started", false);
      return;
    }
    // Prevent inactivity timeouts during long server-side synthesis.
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }
    // sessionId is guaranteed to exist after the check above
    const sessionId = state.sessionId;
    state.assistantText = `Responding to: ${
      state.lastTranscript ?? "no transcript"
    }`;
    this.sendStatus(ws, "processing");
    this.send(ws, {
      _: "final_transcript",
      sessionId,
      text: state.lastTranscript ?? "hello",
    });
    this.send(ws, {
      _: "assistant_message",
      sessionId,
      text: state.assistantText,
    });

    await state.voiceSession.streamSynthesis(
      state.assistantText,
      state.voice,
      (buffer) => {
        this.stats.ttsChunks += 1;
        state.sequence += 1;
        this.send(ws, {
          _: "tts_chunk",
          sessionId,
          audioBase64: buffer.toString("base64"),
          mimeType: "audio/mpeg",
          sequence: state.sequence,
        });
      }
    );

    this.send(ws, { _: "tts_complete", sessionId: state.sessionId });
    this.sendStatus(ws, "idle");
    state.timeoutMs = SESSION_TIMEOUT_MS;
    this.armTimeout(ws);
    if (reason === "manual" || reason === "silence") {
      this.stats.completed += 1;
    }
  }

  private sendStatus(
    ws: WebSocket,
    state: "recording" | "processing" | "playing" | "idle"
  ) {
    const conn = this.connections.get(ws);
    if (!conn?.sessionId) {
      return;
    }
    this.send(ws, {
      _: "status",
      sessionId: conn.sessionId,
      state,
    });
  }

  private emitError(ws: WebSocket, message: string, closeAfter: boolean) {
    const state = this.connections.get(ws);
    this.stats.errors += 1;
    this.send(ws, {
      _: "error",
      sessionId: state?.sessionId ?? null,
      message,
      code: message,
    });
    if (closeAfter) {
      ws.close(1011, message);
    }
  }

  private cleanup(ws: WebSocket) {
    const state = this.connections.get(ws);
    if (!state || state.closed) {
      return;
    }
    state.closed = true;
    if (state.sessionId && this.registry) {
      this.registry.registry.removeSession(state.sessionId);
    }
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
    }
    this.connections.delete(ws);
    this.stats.cleaned += 1;
  }

  private armTimeout(ws: WebSocket) {
    const state = this.connections.get(ws);
    if (!state) {
      return;
    }
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
    }
    state.inactivityTimer = setTimeout(() => {
      if (!state.closed) {
        this.emitError(ws, "session_timeout", true);
      }
    }, state.timeoutMs);
  }

  private send(ws: WebSocket, payload: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}

type VoiceEventLog = {
  sessionId: string | null;
  partialTranscripts: string[];
  finalTranscripts: string[];
  assistantMessages: string[];
  ttsChunks: number;
  statuses: string[];
  errors: string[];
  ttsComplete: boolean;
};

function createVoiceEventLog(): VoiceEventLog {
  return {
    sessionId: null,
    partialTranscripts: [],
    finalTranscripts: [],
    assistantMessages: [],
    ttsChunks: 0,
    statuses: [],
    errors: [],
    ttsComplete: false,
  };
}

function createVoiceClient(
  log: VoiceEventLog,
  overrides?: Partial<ConstructorParameters<typeof VoiceStreamClient>[0]>
) {
  const handlers: VoiceStreamClientHandlers = {
    onSessionStarted: (event) => {
      log.sessionId = event.sessionId;
    },
    onPartialTranscript: (event) => {
      log.partialTranscripts.push(event.text);
    },
    onFinalTranscript: (event) => {
      log.finalTranscripts.push(event.text);
    },
    onAssistantMessage: (event) => {
      log.assistantMessages.push(event.text);
    },
    onTtsChunk: () => {
      log.ttsChunks += 1;
    },
    onTtsComplete: () => {
      log.ttsComplete = true;
    },
    onStatus: (event) => {
      log.statuses.push(event.state);
    },
    onError: (event) => {
      log.errors.push(event.message);
    },
  };
  const client = new VoiceStreamClient(
    {
      url: STREAM_URL,
      headers: { Authorization: AUTH_TOKEN },
      ...overrides,
    },
    handlers
  );
  return client;
}

function makePcmChunk(length = 320): Buffer {
  const buffer = Buffer.alloc(length * 2);
  for (let i = 0; i < length; i += 1) {
    buffer.writeInt16LE(Math.sin(i / 10) * 16_000, i * 2);
  }
  return buffer;
}

test.describe("Voice Session E2E", () => {
  let server: MockVoiceStreamingServer;

  test.beforeAll(async () => {
    server = await MockVoiceStreamingServer.start();
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("streams audio and receives synthesized reply", async () => {
    const log = createVoiceEventLog();
    const client = createVoiceClient(log, {
      headers: { Authorization: AUTH_TOKEN, "x-test-timeout-ms": "30000" },
    });
    const sessionId = await client.startSession({
      sessionId: `session-${Date.now()}`,
      codec: "pcm",
      autoStop: false,
      surface: "web",
      ttsVoice: "maya",
    });
    expect(sessionId).toBeTruthy();

    await client.sendAudioChunk({
      audio: makePcmChunk(),
      mimeType: "audio/pcm",
    });
    await client.sendAudioChunk({
      audio: makePcmChunk(),
      mimeType: "audio/pcm",
    });
    await client.stop("manual");

    await expect
      .poll(() => log.finalTranscripts.length, {
        timeout: 2000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => log.ttsChunks, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect.poll(() => log.ttsComplete, { timeout: 10_000 }).toBe(true);
    expect(log.assistantMessages[0]).toContain("Responding to");
    expect(log.statuses.includes("recording")).toBeTruthy();
    expect(log.statuses.at(-1)).toBe("idle");

    await client.close();
  });

  test("handles server-side errors and surfaces them to the client", async () => {
    const log = createVoiceEventLog();
    const client = createVoiceClient(log);
    await expect(
      client.startSession({
        sessionId: `codec-error-${Date.now()}`,
        codec: "wav", // Triggers simulated error branch
      })
    ).rejects.toThrow("codec_not_supported");
    await expect
      .poll(() => log.errors[0], { timeout: 2000 })
      .toBe("codec_not_supported");
    await client.close();
  });

  test("times out idle sessions and cleans up registry state", async () => {
    const baseline = server.getStats().cleaned;
    const log = createVoiceEventLog();
    const client = createVoiceClient(log);
    await client.startSession({
      sessionId: `timeout-${Date.now()}`,
    });
    await delay(SESSION_TIMEOUT_MS + 200);
    expect(log.errors).toContain("session_timeout");
    await client.close();
    await expect
      .poll(() => server.getStats().cleaned)
      .toBeGreaterThan(baseline);
  });

  test("supports multiple concurrent sessions", async () => {
    const logA = createVoiceEventLog();
    const logB = createVoiceEventLog();
    const clientA = createVoiceClient(logA);
    const clientB = createVoiceClient(logB, {
      headers: { Authorization: AUTH_TOKEN, "x-test-user": "secondary-user" },
    });
    await Promise.all([
      clientA.startSession({ sessionId: `multi-a-${Date.now()}` }),
      clientB.startSession({ sessionId: `multi-b-${Date.now()}` }),
    ]);
    await Promise.all([
      clientA.sendAudioChunk({ audio: makePcmChunk(), mimeType: "audio/pcm" }),
      clientB.sendAudioChunk({ audio: makePcmChunk(), mimeType: "audio/pcm" }),
    ]);
    await Promise.all([clientA.stop("manual"), clientB.stop("manual")]);
    await expect.poll(() => logA.finalTranscripts.length).toBeGreaterThan(0);
    await expect.poll(() => logB.finalTranscripts.length).toBeGreaterThan(0);
    expect(logA.sessionId).not.toBe(logB.sessionId);
    await Promise.all([clientA.close(), clientB.close()]);
  });

  test("cleans up sessions when the client disconnects abruptly", async () => {
    const log = createVoiceEventLog();
    const client = createVoiceClient(log);
    await client.startSession({
      sessionId: `aborted-${Date.now()}`,
    });
    await client.sendAudioChunk({
      audio: makePcmChunk(),
      mimeType: "audio/pcm",
    });
    await client.close(); // abrupt close without stop
    await delay(100);
    expect(server.getActiveSessions()).toBe(0);
  });
});
