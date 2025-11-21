import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { getVoicePools } from "./pools";
import type { VoiceSession } from "./session";
import { logger } from "../utils/logger";

const DEFAULT_PORT = 8788;
let server: ReturnType<typeof Bun.serve> | null = null;
const activeSessions = new Map<string, VoiceSession>();

interface VoiceStreamData {
  sessionId?: string;
  userId?: string;
}

function parseMessage(message: string | ArrayBuffer | Uint8Array) {
  try {
    const text = typeof message === "string" ? message : Buffer.from(message).toString();
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error("invalid_json" + (error instanceof Error ? `: ${error.message}` : ""));
  }
}

function send(ws: ServerWebSocket<VoiceStreamData>, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.error("voice_stream_proto_send_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function ensureSessionManager() {
  try {
    const { sessionManager } = getVoicePools();
    return sessionManager;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "voice_session_manager_unavailable"
    );
  }
}

async function handleStart(
  ws: ServerWebSocket<VoiceStreamData>,
  payload: Record<string, unknown>
) {
  const sessionManager = ensureSessionManager();
  const sessionId = (typeof payload.sessionId === "string" && payload.sessionId) || randomUUID();
  const language = typeof payload.language === "string" ? payload.language : undefined;
  const userId = "voice-stream-proto";

  sessionManager.removeSession(sessionId);
  const session = sessionManager.createSession(userId, sessionId, language);
  ws.data.sessionId = sessionId;
  ws.data.userId = userId;
  activeSessions.set(sessionId, session);
  logger.info("voice_stream_proto_start", { sessionId, language });
  send(ws, { type: "session_started", sessionId });
}

async function handleChunk(
  ws: ServerWebSocket<VoiceStreamData>,
  payload: Record<string, unknown>
) {
  const sessionId = ws.data.sessionId;
  if (!sessionId) {
    throw new Error("session_not_started");
  }
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error("session_missing");
  }
  const audioBase64 = typeof payload.audioBase64 === "string" ? payload.audioBase64 : null;
  if (!audioBase64) {
    throw new Error("audio_chunk_missing");
  }
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "audio/pcm";
  await session.processAudioChunk(audioBase64, mimeType);
  const emitPartial = payload.emitPartial !== false;
  if (emitPartial) {
    const transcript = session.getTranscript();
    send(ws, {
      type: "partial_transcript",
      sessionId,
      text: transcript,
    });
  }
  logger.debug("voice_stream_proto_chunk", { sessionId, bytes: audioBase64.length });
}

function finalizeSession(sessionId: string | undefined) {
  if (!sessionId) return;
  const session = activeSessions.get(sessionId);
  if (session) {
    const manager = ensureSessionManager();
    manager.removeSession(sessionId);
    activeSessions.delete(sessionId);
  }
}

async function handleStop(ws: ServerWebSocket<VoiceStreamData>) {
  const sessionId = ws.data.sessionId;
  if (!sessionId) {
    return;
  }
  const session = activeSessions.get(sessionId);
  if (!session) {
    return;
  }
  const transcript = session.getTranscript();
  send(ws, { type: "final_transcript", sessionId, text: transcript });
  finalizeSession(sessionId);
}

function handleMessage(ws: ServerWebSocket<VoiceStreamData>, raw: string | ArrayBuffer | Uint8Array) {
  const event = parseMessage(raw);
  const type = typeof event.type === "string" ? event.type : null;
  if (!type) {
    throw new Error("event_type_missing");
  }
  switch (type) {
    case "start":
      return handleStart(ws, event);
    case "audio_chunk":
      return handleChunk(ws, event);
    case "stop":
      return handleStop(ws);
    case "ping":
      return send(ws, { type: "pong" });
    default:
      throw new Error(`unknown_event_type:${type}`);
  }
}

export function startVoiceStreamingPrototype(): void {
  if (server || process.env.VOICE_STREAMING_PROTO !== "1") {
    return;
  }
  if ((process.env.VOICE_PROVIDER ?? "openai") !== "local") {
    logger.warn("voice_stream_proto_disabled", {
      reason: "local_provider_required",
    });
    return;
  }

  const port = Number(process.env.VOICE_STREAMING_PORT ?? DEFAULT_PORT);

  server = Bun.serve<VoiceStreamData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/voice/stream") {
        const upgraded = server.upgrade(req, { data: {} });
        if (!upgraded) {
          return new Response("upgrade_failed", { status: 500 });
        }
        return undefined;
      }
      return new Response("voice streaming prototype", { status: 200 });
    },
    websocket: {
      open(ws) {
        send(ws, { type: "ready", sessionId: null });
      },
      async message(ws, message) {
        try {
          await handleMessage(ws, message);
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          logger.error("voice_stream_proto_error", {
            error: messageText,
            sessionId: ws.data.sessionId,
          });
          send(ws, {
            type: "error",
            sessionId: ws.data.sessionId ?? null,
            message: messageText,
          });
        }
      },
      close(ws) {
        finalizeSession(ws.data.sessionId);
      },
    },
  });

  logger.info("voice_stream_proto_listening", {
    port,
  });
}

export function stopVoiceStreamingPrototype(): void {
  if (!server) {
    return;
  }
  try {
    server.stop(true);
  } catch (error) {
    logger.error("voice_stream_proto_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  server = null;
  activeSessions.clear();
}
