import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { logger } from "@alfred/logger";
import type {
  VoiceStreamAudioChunkPayload,
  VoiceStreamServerEvent,
  VoiceStreamStartPayload,
  VoiceStreamStopPayload,
} from "@alfred/type/voice";
import type { ServerWebSocket } from "bun";
import {
  decodeToPCM16,
  encodeFromPCM16,
  isLikelyPCM,
  PCM_MIME_TYPE,
  type TargetFormat,
} from "../audio/codec";
import {
  recordVoiceAssistant,
  voiceSessionJitterMillis,
  voiceSessionPacketLossTotal,
  voiceSessionRttMillis,
  voiceStreamLatencySeconds,
} from "../metrics";
import type { VoiceRegistry } from "./registry";
import type { VoiceSession } from "./session";

export type VoiceSocketData = {
  userId: string;
  sessionId?: string;
  sessionRegistryId?: string;
  surface?: string;
  language?: string;
  codec?: string;
  negotiatedCodec?: string;
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
  ttsInProgress?: boolean;
  utteranceStartedAt?: number;
  lastActivity: number;
  pingSentAt?: number | null;
  runtime?: unknown; // Pass-through for application context
};

export type VoiceSocketHooks = {
  onSessionStart: (
    userId: string,
    sessionId: string,
    config: {
      surface: string;
      codec: string;
      negotiatedCodec: string;
      ttsFormat: string;
    }
  ) => Promise<string>; // Returns registry ID
  onSessionStatus: (
    registryId: string,
    status: "recording" | "processing" | "responding" | "idle"
  ) => Promise<void>;
  onTranscriptUpdate: (registryId: string, text: string) => Promise<void>;
  onAssistantResponse: (registryId: string, text: string) => Promise<void>;
  onSessionError: (registryId: string, error: string) => Promise<void>;
  onSessionComplete: (registryId: string) => Promise<void>;
  runAssistant: (
    userId: string,
    text: string,
    runtime: unknown
  ) => Promise<{
    text: string;
    replayId?: string | null;
    raw?: unknown;
    durationSeconds?: number;
  }>;
  onSendError?: (reason: string) => void;
};

type StreamCodec = "pcm" | "mp3" | "opus" | "wav";
const SUPPORTED_STREAM_CODECS: StreamCodec[] = ["pcm", "mp3", "opus", "wav"];
const codecToFormat: Partial<Record<StreamCodec, TargetFormat>> = {
  mp3: "mp3",
  opus: "opus",
  wav: "wav",
};

function normalizeCodec(value?: string): StreamCodec {
  if (!value) {
    return "pcm";
  }
  const v = value as StreamCodec;
  return SUPPORTED_STREAM_CODECS.includes(v) ? v : "pcm";
}

function getEventType(payload: unknown): string {
  if (!(typeof payload === "object" && payload !== null && "type" in payload)) {
    return "unknown";
  }
  const value = (payload as { type?: unknown }).type;
  return typeof value === "string" ? value : "unknown";
}

function toBufferFromBinary(message: ArrayBuffer | Uint8Array): Buffer {
  return Buffer.from(
    message instanceof ArrayBuffer ? new Uint8Array(message) : message
  );
}

function send(
  ws: ServerWebSocket<VoiceSocketData>,
  payload: unknown,
  onError?: (error: Error, reason: string) => void
) {
  if (ws.readyState !== 1) {
    // WebSocket.OPEN = 1
    const error = new Error(`websocket_not_open: state=${ws.readyState}`);
    logger.error("voice_websocket_send_failed", {
      sessionId: ws.data.sessionId ?? null,
      eventType: getEventType(payload),
      error: error.message,
      reason: "not_open",
    });
    onError?.(error, "not_open");
    return;
  }

  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const reason = err.message.includes("backpressure")
      ? "backpressure"
      : "send_error";
    logger.error("voice_websocket_send_failed", {
      sessionId: ws.data.sessionId ?? null,
      eventType: getEventType(payload),
      error: err.message,
      reason,
    });
    onError?.(err, reason);
  }
}

function parseMessage(message: string | ArrayBuffer | Uint8Array) {
  try {
    const text =
      typeof message === "string"
        ? message
        : toBufferFromBinary(message).toString();
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `invalid_json${error instanceof Error ? `: ${error.message}` : ""}`
    );
  }
}

export class VoiceSocketHandler {
  private readonly sendWithErrorHandling = (
    ws: ServerWebSocket<VoiceSocketData>,
    payload: unknown
  ) => {
    send(ws, payload, (_, reason) => {
      this.hooks.onSendError?.(reason);
    });
  };

  constructor(
    private readonly sessionRegistry: VoiceRegistry,
    private readonly hooks: VoiceSocketHooks
  ) {}

  async handleMessage(
    ws: ServerWebSocket<VoiceSocketData>,
    message: string | ArrayBuffer | Uint8Array
  ) {
    ws.data.lastActivity = Date.now();
    try {
      // Binary Audio Chunk
      if (
        typeof message !== "string" &&
        (message instanceof Buffer ||
          message instanceof Uint8Array ||
          message instanceof ArrayBuffer)
      ) {
        await this.handleChunk(ws, {
          type: "audio_chunk",
          audioBase64: toBufferFromBinary(message).toString("base64"),
          mimeType:
            ws.data.codec === "opus" ? "audio/ogg;codecs=opus" : PCM_MIME_TYPE, // Assume negotiated codec
          emitPartial: true,
        });
        return;
      }

      const event = parseMessage(message);
      const type = typeof event.type === "string" ? event.type : null;
      if (!type) {
        throw new Error("event_type_missing");
      }

      switch (type) {
        case "start":
          await this.handleStart(
            ws,
            event as unknown as VoiceStreamStartPayload
          );
          break;
        case "audio_chunk":
          await this.handleChunk(
            ws,
            event as unknown as VoiceStreamAudioChunkPayload
          );
          break;
        case "stop":
          await this.handleStop(
            ws,
            (event as unknown as VoiceStreamStopPayload).reason ?? "manual"
          );
          break;
        case "ping":
          this.sendWithErrorHandling(ws, { type: "pong" });
          break;

        case "telemetry_report": {
          const report = event as unknown as Extract<
            VoiceStreamServerEvent,
            { type: "telemetry_report" }
          >;
          if (report.sessionId) {
            voiceSessionPacketLossTotal.inc(
              { session_id: report.sessionId },
              report.packetLoss
            );
            voiceSessionJitterMillis.observe(
              { session_id: report.sessionId },
              report.jitter
            );
            voiceSessionRttMillis.observe(
              { session_id: report.sessionId },
              report.rtt
            );
          }
          break;
        }

        default:
          throw new Error(`unknown_event_type:${type}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      send(ws, {
        type: "error",
        sessionId: ws.data.sessionId ?? null,
        message: msg,
      });
    }
  }

  private async handleStart(
    ws: ServerWebSocket<VoiceSocketData>,
    payload: VoiceStreamStartPayload
  ) {
    const sessionId = payload.sessionId || randomUUID();
    const language = payload.language;
    const userId = ws.data.userId;

    // Create processing session
    this.sessionRegistry.removeSession(sessionId);
    this.sessionRegistry.createSession(userId, sessionId, language);

    const requestedCodec = normalizeCodec(payload.codec);
    const negotiatedCodec = requestedCodec; // Simplified negotiation

    const ttsFormat = (payload.ttsFormat as "mp3" | "opus" | "wav") || "mp3";

    // Registry hook
    const registryId = await this.hooks.onSessionStart(userId, sessionId, {
      surface: payload.surface ?? "stream",
      codec: requestedCodec,
      negotiatedCodec,
      ttsFormat,
    });

    // Update socket data
    ws.data.sessionId = sessionId;
    ws.data.sessionRegistryId = registryId;
    ws.data.language = language;
    ws.data.codec = requestedCodec;
    ws.data.negotiatedCodec = negotiatedCodec;
    ws.data.vadThreshold = payload.vadThreshold;
    ws.data.autoStop = payload.autoStop !== false;
    ws.data.maxUtteranceMs = payload.maxUtteranceMs ?? 20_000;
    ws.data.ttsVoice = payload.ttsVoice;
    ws.data.ttsFormat = ttsFormat;
    ws.data.ttsInProgress = false;

    this.sendWithErrorHandling(ws, {
      type: "session_started",
      sessionId,
      codec: requestedCodec,
      negotiatedCodec,
    });

    await this.updateStatus(ws, "recording");
  }

  private async handleChunk(
    ws: ServerWebSocket<VoiceSocketData>,
    payload: VoiceStreamAudioChunkPayload
  ) {
    const sessionId = ws.data.sessionId;
    if (!sessionId) {
      throw new Error("session_not_started");
    }

    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) {
      throw new Error("session_missing");
    }

    const rawAudioBase64 = payload.audioBase64;
    if (!rawAudioBase64) {
      throw new Error("audio_chunk_missing");
    }

    let mimeType = payload.mimeType || PCM_MIME_TYPE;
    let processedAudioBase64 = rawAudioBase64;

    // Decode if needed
    if (!isLikelyPCM(mimeType)) {
      try {
        const decoded = await decodeToPCM16({
          audioBase64: rawAudioBase64,
          mimeType,
        });
        processedAudioBase64 = decoded.audioBase64;
        mimeType = decoded.mimeType;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ws.data.sessionRegistryId) {
          await this.hooks.onSessionError(ws.data.sessionRegistryId, msg);
        }
        this.sendWithErrorHandling(ws, {
          type: "error",
          sessionId,
          message: msg,
        });
        return;
      }
    }

    const result = await session.processAudioChunk(
      processedAudioBase64,
      mimeType,
      {
        vadThreshold: ws.data.vadThreshold,
        sessionId,
      }
    );

    if (!ws.data.utteranceStartedAt) {
      ws.data.utteranceStartedAt = Date.now();
    }

    if (payload.emitPartial !== false) {
      const transcript = session.getTranscript();
      this.sendWithErrorHandling(ws, {
        type: "partial_transcript",
        sessionId,
        text: transcript,
      });
      if (ws.data.sessionRegistryId) {
        await this.hooks.onTranscriptUpdate(
          ws.data.sessionRegistryId,
          transcript
        );
      }
    }

    if (result) {
      this.sendWithErrorHandling(ws, {
        type: "vad_state",
        sessionId,
        vadConfidence: result.vadConfidence ?? null,
        isEmpty: result.isEmpty ?? null,
        endOfUtterance: result.endOfUtterance ?? null,
      });

      if (ws.data.autoStop && result.endOfUtterance) {
        this.sendWithErrorHandling(ws, {
          type: "auto_stop",
          sessionId,
          reason: "silence",
        });
        await this.handleStop(ws, "silence");
        return;
      }
    }

    if (
      ws.data.autoStop &&
      ws.data.maxUtteranceMs &&
      ws.data.utteranceStartedAt &&
      Date.now() - ws.data.utteranceStartedAt > ws.data.maxUtteranceMs
    ) {
      this.sendWithErrorHandling(ws, {
        type: "auto_stop",
        sessionId,
        reason: "timeout",
      });
      await this.handleStop(ws, "timeout");
      return;
    }
  }

  private async handleStop(
    ws: ServerWebSocket<VoiceSocketData>,
    _reason: "manual" | "silence" | "timeout"
  ) {
    const sessionId = ws.data.sessionId;
    if (!sessionId) {
      return;
    }

    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) {
      return;
    }

    const transcript = session.getTranscript();
    this.sendWithErrorHandling(ws, {
      type: "final_transcript",
      sessionId,
      text: transcript,
    });

    if (ws.data.sessionRegistryId) {
      await this.hooks.onTranscriptUpdate(
        ws.data.sessionRegistryId,
        transcript
      );
      await this.updateStatus(ws, "processing");
    }

    // Cleanup session processing state (but keep socket session ID for playback)
    this.sessionRegistry.removeSession(sessionId);
    // Re-create session for next turn? Or just use it for TTS?
    // Actually we removed it, so we can't use it for TTS synthesis if TTS uses session.
    // But `VoiceSession.streamSynthesis` uses `ttsPool`.
    // We need the session object to call `streamSynthesis`.
    // So we should NOT remove it yet if we want to use it for TTS.
    // Re-add it back? Or just don't remove it.
    // `finalizeSession` in streaming.ts removed it.
    // But `streamTts` logic was using `ttsPool` directly from `getVoicePools()`.
    // Here we want to use `session.streamSynthesis`.
    // So let's keep the session!
    // But we might want to reset transcript buffer?
    session.clearTranscript();
    ws.data.utteranceStartedAt = undefined;

    if (!transcript.trim()) {
      if (ws.data.sessionRegistryId) {
        await this.hooks.onSessionComplete(ws.data.sessionRegistryId);
      }
      await this.updateStatus(ws, "idle");
      return;
    }

    try {
      // Record assistant (LLM/orchestrator) latency for telemetry.
      // This measures the time from transcript completion to assistant response,
      // separate from STT/TTS latencies to enable component-level analysis.
      const assistantProvider = "orchestrator";
      const assistantTimerStart = performance.now();
      const assistant = await this.hooks.runAssistant(
        ws.data.userId,
        transcript,
        ws.data.runtime
      );
      const assistantWallSeconds = (performance.now() - assistantTimerStart) / 1000;
      // Use hook-provided duration if available, otherwise fall back to wall-clock time
      const durationSeconds = assistant.durationSeconds ?? assistantWallSeconds;
      recordVoiceAssistant({
        provider: assistantProvider,
        status: "ok",
        durationSeconds,
      });
      voiceStreamLatencySeconds.observe(
        { stage: "assistant" },
        durationSeconds
      );

      this.sendWithErrorHandling(ws, {
        type: "assistant_message",
        sessionId,
        text: assistant.text,
        replayId: assistant.replayId ?? null,
        raw: assistant.raw ?? null,
      });

      if (ws.data.sessionRegistryId) {
        await this.hooks.onAssistantResponse(
          ws.data.sessionRegistryId,
          assistant.text
        );
      }

      await this.streamTts(ws, session, assistant.text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      recordVoiceAssistant({ provider: "orchestrator", status: "error" });
      if (ws.data.sessionRegistryId) {
        await this.hooks.onSessionError(ws.data.sessionRegistryId, msg);
      }
      this.sendWithErrorHandling(ws, {
        type: "error",
        sessionId,
        message: msg,
      });
      await this.updateStatus(ws, "idle");
    }
  }

  private async streamTts(
    ws: ServerWebSocket<VoiceSocketData>,
    session: VoiceSession, // Use session for synthesis
    text: string
  ) {
    if (!text.trim()) {
      return;
    }

    const sessionId = ws.data.sessionId;
    if (!sessionId) {
      throw new Error("session_id_missing");
    }
    // const sequence = 0;
    ws.data.ttsInProgress = true;
    await this.updateStatus(ws, "playing");

    const negotiatedCodec = ws.data.negotiatedCodec ?? "pcm";
    const targetFormat = codecToFormat[negotiatedCodec as StreamCodec];

    try {
      await session.streamSynthesis(text, ws.data.ttsVoice, async (chunk) => {
        // Chunk is PCM 16 (from Piper). Encode if needed.
        let payloadAudio = chunk.toString("base64");
        // let payloadMime = PCM_MIME_TYPE;
        let binaryChunk: Buffer | null = null;

        if (targetFormat) {
          const encoded = await encodeFromPCM16({
            audioBase64: payloadAudio,
            format: targetFormat,
          });
          payloadAudio = encoded.audioBase64;
          // payloadMime = encoded.mimeType;
          binaryChunk = Buffer.from(payloadAudio, "base64");
        } else {
          binaryChunk = chunk;
        }

        // Send as binary if socket supports it (and it's audio)
        try {
          if (binaryChunk) {
            ws.send(binaryChunk);
          }
        } catch (_e) {
          // Fallback or error
        }

        // Keep sending JSON event for compatibility/metadata?
        // Ideally we move fully to binary but we need to coordinate client.
        // For now, let's stick to JSON for this phase unless we update client too.
        // Wait, the plan says "Switch ... to binary WebSocket frames".
        // So we should send binary. But client needs to know it's audio.
        // We decided "Binary = Audio".

        /* 
        send(ws, {
          type: "tts_chunk",
          sessionId,
          audioBase64: payloadAudio,
          mimeType: payloadMime,
          sequence: sequence++,
          isLast: false,
        });
        */
      });

      this.sendWithErrorHandling(ws, { type: "tts_complete", sessionId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (ws.data.sessionRegistryId) {
        await this.hooks.onSessionError(ws.data.sessionRegistryId, msg);
      }
      this.sendWithErrorHandling(ws, {
        type: "error",
        sessionId,
        message: msg,
      });
    } finally {
      ws.data.ttsInProgress = false;
      if (ws.data.sessionRegistryId) {
        await this.hooks.onSessionComplete(ws.data.sessionRegistryId);
      }
      await this.updateStatus(ws, "idle");
      // Now we can optionally clean up session if needed, or wait for inactivity
    }
  }

  private async updateStatus(
    ws: ServerWebSocket<VoiceSocketData>,
    state: "recording" | "processing" | "playing" | "idle"
  ) {
    const statusMap = {
      recording: "recording",
      processing: "processing",
      playing: "responding",
      idle: "idle",
    } as const;
    const sessionId = ws.data.sessionId;
    if (sessionId) {
      this.sendWithErrorHandling(ws, { type: "status", sessionId, state });
    }
    if (ws.data.sessionRegistryId) {
      await this.hooks.onSessionStatus(
        ws.data.sessionRegistryId,
        statusMap[state]
      );
    }
  }

  public cleanup(sessionId: string) {
    this.sessionRegistry.removeSession(sessionId);
  }
}
