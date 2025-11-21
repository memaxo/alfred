import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { auth } from "@alfred/auth";
import * as policyRepo from "@alfred/db/repo/policy";
import type { EvaluateInput, PolicyResource } from "@alfred/policy";
import { evaluate } from "@alfred/policy";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { VoiceStreamSurface } from "@alfred/type/voice";
import { getVoicePools } from "./pools";
import type { VoiceSession } from "./session";
import {
  claimVoiceSession,
  completeVoiceSession,
  markVoiceSessionError,
  releaseVoiceSession,
  updateVoiceSession,
} from "./session-registry";
import type { VoiceSessionStatus } from "./session-registry";
import {
  policyDecisionsTotal,
  policyObligationsTotal,
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
} from "../metrics";
import { createContext } from "../context";
import {
  getSessionUser,
  getSessionUserId,
  getSessionUserRoles,
  getSessionUserScopes,
} from "../utils/session";
import { logger } from "../utils/logger";
import { runAssistantForVoice } from "./assistant";
import {
  PCM_MIME_TYPE,
  decodeToPCM16,
  isLikelyPCM,
} from "./codec";

const DEFAULT_PORT = 8788;
let server: ReturnType<typeof Bun.serve> | null = null;
const activeSessions = new Map<string, VoiceSession>();
const STREAM_RESOURCE: PolicyResource = {
  kind: "voice.model",
  id: "local-streaming",
};
const REQUIRED_ACTIONS = ["voice.stt", "voice.tts"] as const;

function incrementStreamEvent(event: string, status: "ok" | "error" = "ok") {
  voiceStreamEventsTotal.labels(event, status).inc();
}

function sendStatusEvent(
  ws: ServerWebSocket<VoiceStreamData>,
  sessionId: string,
  state: "recording" | "processing" | "playing" | "idle"
) {
  send(ws, { type: "status", sessionId, state });
  incrementStreamEvent("status");
  if (ws.data.sessionRegistryId) {
    const statusMap: Record<typeof state, VoiceSessionStatus> = {
      recording: "recording",
      processing: "processing",
      playing: "responding",
      idle: "idle",
    };
    updateVoiceSession(ws.data.sessionRegistryId, {
      status: statusMap[state],
    });
  }
}

type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

export class VoiceStreamAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VoiceStreamAuthError";
    this.status = status;
  }
}

type StreamCodec = "pcm" | "mp3" | "opus" | "wav";

interface VoiceStreamData {
  sessionId?: string;
  userId?: string;
  runtime?: RuntimeContext;
  codec?: StreamCodec;
  negotiatedCodec?: StreamCodec;
  surface?: VoiceStreamSurface;
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
  ttsInProgress?: boolean;
  utteranceStartedAt?: number;
  language?: string;
  sessionRegistryId?: string;
}

async function evaluateVoicePolicy(
  session: AuthSession,
  action: (typeof REQUIRED_ACTIONS)[number],
  resource: PolicyResource
) {
  const sessionUser = getSessionUser(session);
  const subjectId = getSessionUserId(sessionUser);
  const subjectRoles = getSessionUserRoles(sessionUser);
  const subjectScopes = getSessionUserScopes(sessionUser) ?? undefined;

  const evaluation: EvaluateInput = {
    subject: {
      id: subjectId,
      roles: subjectRoles,
      scopes: subjectScopes,
    },
    action,
    resource,
  };

  const decision = await evaluate(evaluation);
  await policyRepo.createAuditLog({
    userId: subjectId,
    action,
    resource,
    decision: decision.allow ? "allow" : "deny",
    traceId: null,
    obligations: decision.obligations,
    context: null,
  });
  policyDecisionsTotal.labels(action, decision.allow ? "allow" : "deny").inc();
  if (decision.obligations && decision.obligations.length > 0) {
    for (const obligation of decision.obligations) {
      policyObligationsTotal.labels(action, String(obligation)).inc();
    }
  }

  if (!decision.allow) {
    throw new VoiceStreamAuthError(
      decision.reason ?? "voice_stream_forbidden",
      403
    );
  }
}

export async function authorizeVoiceStreamRequest(req: Request) {
  let session: AuthSession | null = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    session = null;
  }
  if (!session) {
    throw new VoiceStreamAuthError("session_required", 401);
  }
  const sessionUser = getSessionUser(session);
  if (!sessionUser?.id) {
    throw new VoiceStreamAuthError("session_required", 401);
  }
  for (const action of REQUIRED_ACTIONS) {
    await evaluateVoicePolicy(session, action, STREAM_RESOURCE);
  }
  return {
    userId: sessionUser.id,
  };
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
  const userId = ws.data.userId;
  if (!userId) {
    throw new Error("stream_user_missing");
  }

  sessionManager.removeSession(sessionId);
  const session = sessionManager.createSession(userId, sessionId, language);
  const codec =
    payload.codec === "mp3" || payload.codec === "opus" || payload.codec === "wav"
      ? (payload.codec as StreamCodec)
      : "pcm";
  const vadThreshold =
    typeof payload.vadThreshold === "number" && payload.vadThreshold >= 0 && payload.vadThreshold <= 1
      ? payload.vadThreshold
      : undefined;
  const autoStop = payload.autoStop !== false;
  const maxUtteranceMs =
    typeof payload.maxUtteranceMs === "number" && payload.maxUtteranceMs > 0
      ? payload.maxUtteranceMs
      : 20_000;
  const ttsVoice =
    typeof payload.ttsVoice === "string" && payload.ttsVoice.trim().length > 0
      ? payload.ttsVoice.trim()
      : undefined;
  const ttsFormat =
    payload.ttsFormat === "mp3" || payload.ttsFormat === "opus" || payload.ttsFormat === "wav"
      ? (payload.ttsFormat as "mp3" | "opus" | "wav")
      : "mp3";

  const registrySession = claimVoiceSession({
    userId,
    sessionId,
    surface: typeof payload.surface === "string" ? payload.surface : ws.data.surface ?? "stream",
    mode: "stream",
    codec: { input: codec, output: ttsFormat },
  });
  updateVoiceSession(registrySession.id, { status: "recording" });

  ws.data.sessionRegistryId = registrySession.id;
  ws.data.surface = registrySession.surface;
  ws.data.sessionId = sessionId;
  ws.data.userId = userId;
  ws.data.language = language;
  ws.data.codec = codec;
  ws.data.negotiatedCodec = "pcm"; // PCM streaming today; future codecs negotiated here
  ws.data.vadThreshold = vadThreshold;
  ws.data.autoStop = autoStop;
  ws.data.maxUtteranceMs = maxUtteranceMs;
  ws.data.ttsVoice = ttsVoice;
  ws.data.ttsFormat = ttsFormat;
  ws.data.ttsInProgress = false;
  ws.data.utteranceStartedAt = undefined;
  activeSessions.set(sessionId, session);
  logger.info("voice_stream_proto_start", {
    sessionId,
    language,
    codec,
    negotiatedCodec: ws.data.negotiatedCodec,
  });
  incrementStreamEvent("session_started");
  send(ws, {
    type: "session_started",
    sessionId,
    codec,
    negotiatedCodec: ws.data.negotiatedCodec,
  });
  sendStatusEvent(ws, sessionId, "recording");
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
  const rawAudioBase64 =
    typeof payload.audioBase64 === "string" ? payload.audioBase64 : null;
  if (!rawAudioBase64) {
    throw new Error("audio_chunk_missing");
  }
  let mimeType =
    typeof payload.mimeType === "string" ? payload.mimeType : PCM_MIME_TYPE;

  let processedAudioBase64 = rawAudioBase64;
  if (!isLikelyPCM(mimeType)) {
    try {
      const decoded = await decodeToPCM16({
        audioBase64: rawAudioBase64,
        mimeType,
      });
      processedAudioBase64 = decoded.audioBase64;
      mimeType = decoded.mimeType;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      logger.error("voice_stream_proto_chunk_decode_failed", {
        sessionId,
        mimeType,
        error: messageText,
      });
      if (ws.data.sessionRegistryId) {
        markVoiceSessionError(ws.data.sessionRegistryId, messageText);
      }
      send(ws, {
        type: "error",
        sessionId,
        code: "chunk_decode_failed",
        message: messageText,
      });
      incrementStreamEvent("error", "error");
      return;
    }
  }

  const result = await session.processAudioChunk(processedAudioBase64, mimeType, {
    vadThreshold: ws.data.vadThreshold,
    sessionId,
  });
  const emitPartial = payload.emitPartial !== false;
  if (!ws.data.utteranceStartedAt) {
    ws.data.utteranceStartedAt = Date.now();
  }
  if (emitPartial) {
    const transcript = session.getTranscript();
    send(ws, {
      type: "partial_transcript",
      sessionId,
      text: transcript,
    });
    if (ws.data.sessionRegistryId) {
      updateVoiceSession(ws.data.sessionRegistryId, {
        lastTranscript: transcript,
      });
    }
    incrementStreamEvent("partial_transcript");
  }
  if (result) {
    send(ws, {
      type: "vad_state",
      sessionId,
      vadConfidence: result.vadConfidence ?? null,
      isEmpty: result.isEmpty ?? null,
      endOfUtterance: result.endOfUtterance ?? null,
    });
    incrementStreamEvent("vad_state");
    if (ws.data.autoStop && result.endOfUtterance) {
      send(ws, { type: "auto_stop", sessionId, reason: "silence" });
      incrementStreamEvent("auto_stop");
      await handleStop(ws, "silence");
      return;
    }
  }
  if (
    ws.data.autoStop &&
    ws.data.maxUtteranceMs &&
    ws.data.utteranceStartedAt &&
    Date.now() - ws.data.utteranceStartedAt > ws.data.maxUtteranceMs
  ) {
    send(ws, { type: "auto_stop", sessionId, reason: "timeout" });
    incrementStreamEvent("auto_stop");
    await handleStop(ws, "timeout");
    return;
  }
  logger.debug("voice_stream_proto_chunk", {
    sessionId,
    bytes: processedAudioBase64.length,
  });
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

async function handleStop(
  ws: ServerWebSocket<VoiceStreamData>,
  reason: "manual" | "silence" | "timeout" = "manual"
) {
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
  incrementStreamEvent("final_transcript");
  if (ws.data.sessionRegistryId) {
    updateVoiceSession(ws.data.sessionRegistryId, {
      lastTranscript: transcript,
      status: "processing",
    });
  }
  finalizeSession(sessionId);
  ws.data.sessionId = sessionId; // keep last session id for downstream events
  ws.data.utteranceStartedAt = undefined;

  sendStatusEvent(ws, sessionId, "processing");

  if (!transcript.trim()) {
    if (ws.data.sessionRegistryId) {
      completeVoiceSession(ws.data.sessionRegistryId);
    }
    sendStatusEvent(ws, sessionId, "idle");
    return;
  }

  if (!ws.data.runtime || !ws.data.userId) {
    logger.warn("voice_stream_proto_runtime_missing", { sessionId });
    send(ws, {
      type: "error",
      sessionId,
      code: "assistant_runtime_missing",
      message: "runtime_context_missing",
    });
    incrementStreamEvent("error", "error");
    return;
  }

  let assistantText = "";
  try {
    const assistant = await runAssistantForVoice(ws.data.runtime, {
      text: transcript,
      userId: ws.data.userId,
      thread: undefined,
      resource: undefined,
    });
    assistantText = assistant.text;
    send(ws, {
      type: "assistant_message",
      sessionId,
      text: assistant.text,
      replayId: assistant.replayId ?? null,
      raw: assistant.raw ?? null,
    });
    incrementStreamEvent("assistant_message");
    voiceStreamLatencySeconds.observe({ stage: "assistant" }, assistant.durationSeconds);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logger.error("voice_stream_proto_assistant_failed", {
      sessionId,
      message: messageText,
      reason,
    });
    send(ws, {
      type: "error",
      sessionId,
      code: "assistant_failed",
      message: messageText,
    });
    if (ws.data.sessionRegistryId) {
      markVoiceSessionError(ws.data.sessionRegistryId, messageText);
    }
    incrementStreamEvent("error", "error");
    return;
  }
  if (ws.data.sessionRegistryId) {
    updateVoiceSession(ws.data.sessionRegistryId, {
      lastAssistantText: assistantText,
    });
  }

  await streamTts(ws, assistantText);
}

async function streamTts(ws: ServerWebSocket<VoiceStreamData>, text: string) {
  const sessionId = ws.data.sessionId;
  if (!sessionId || !text.trim()) {
    return;
  }
  const { ttsPool } = getVoicePools();
  let sequence = 0;
  ws.data.ttsInProgress = true;
  const ttsStart = performance.now();
  try {
    sendStatusEvent(ws, sessionId, "playing");
    await ttsPool.synthesize(
      {
        text,
        voice: ws.data.ttsVoice,
        streaming: true,
      },
      (chunk) => {
        send(ws, {
          type: "tts_chunk",
          sessionId,
          audioBase64: chunk.audioBase64,
          mimeType: chunk.mimeType ?? PCM_MIME_TYPE,
          sequence: sequence++,
          isLast: false,
        });
        incrementStreamEvent("tts_chunk");
      }
    );
    send(ws, { type: "tts_complete", sessionId });
    incrementStreamEvent("tts_complete");
    voiceStreamLatencySeconds.observe(
      { stage: "tts" },
      (performance.now() - ttsStart) / 1000
    );
    sendStatusEvent(ws, sessionId, "idle");
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logger.error("voice_stream_proto_tts_failed", {
      sessionId,
      error: messageText,
    });
    if (ws.data.sessionRegistryId) {
      markVoiceSessionError(ws.data.sessionRegistryId, messageText);
    }
    send(ws, {
      type: "error",
      sessionId,
      code: "tts_failed",
      message: messageText,
    });
    incrementStreamEvent("error", "error");
    sendStatusEvent(ws, sessionId, "idle");
  } finally {
    ws.data.ttsInProgress = false;
    if (ws.data.sessionRegistryId) {
      completeVoiceSession(ws.data.sessionRegistryId);
    }
  }
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
      return handleStop(ws, "manual");
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
    async fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/voice/stream") {
        try {
          const [authz, ctx] = await Promise.all([
            authorizeVoiceStreamRequest(req),
            createContext({ req }),
          ]);
          const upgraded = server.upgrade(req, {
            data: { userId: authz.userId, runtime: ctx.runtimeContext },
          });
          if (!upgraded) {
            return new Response("upgrade_failed", { status: 500 });
          }
          return undefined;
        } catch (error) {
          if (error instanceof VoiceStreamAuthError) {
            logger.warn("voice_stream_proto_auth_failed", {
              status: error.status,
              message: error.message,
            });
            return new Response(error.message, { status: error.status });
          }
          logger.error("voice_stream_proto_upgrade_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("voice_stream_error", { status: 500 });
        }
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
        if (ws.data.sessionRegistryId) {
          releaseVoiceSession(ws.data.sessionRegistryId);
          ws.data.sessionRegistryId = undefined;
        }
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
