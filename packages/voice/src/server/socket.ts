import { logger } from "@alfred/logger";
import {
  type VoiceStreamAudioChunkPayload,
  type VoiceStreamServerEvent,
  type VoiceStreamStartPayload,
  type VoiceStreamStopPayload,
} from "@alfred/type/voice";
import { parseVoiceAssistantRaw } from "@alfred/type/voice.zod";
import { type ServerWebSocket } from "bun";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

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
  voiceWebSocketBinaryChunkSizeBytes,
  voiceWebSocketMessageLatencySeconds,
  voiceWebSocketPayloadTooLargeTotal,
} from "../metrics";
import { type VoiceRegistry } from "./registry";
import { type VoiceSession } from "./session";

const MAX_WS_BINARY_BYTES = 64 * 1024;

export interface VoiceSocketData {
  userId: string;
  sessionId?: string;
  sessionRegistryId?: string;
  surface?: string;
  language?: string;
  codec?: string;
  negotiatedCodec?: string;
  inputMimeType?: string;
  sttChunkSize?: "fast" | "low" | "medium" | "accurate";
  needsSttCacheClear?: boolean;
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
  ttsInProgress?: boolean;
  ttsAbortToken?: number;
  utteranceStartedAt?: number;
  lastActivity: number;
  pingSentAt?: number | null;
  lastPongAt?: number | null;
  runtime?: unknown; // Pass-through for application context
}

export interface VoiceSocketHooks {
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
}

type StreamCodec = "pcm" | "mp3" | "opus" | "wav";
const SUPPORTED_STREAM_CODECS: StreamCodec[] = new Set([
  "pcm",
  "mp3",
  "opus",
  "wav",
]);
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
  return SUPPORTED_STREAM_CODECS.has(v) ? v : "pcm";
}

function getEventType(payload: unknown): string {
  if (!(typeof payload === "object" && payload !== null && "_" in payload)) {
    return "unknown";
  }
  const value = (payload as { _?: unknown })._;
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
      error: error.message,
      eventType: getEventType(payload),
      reason: "not_open",
      sessionId: ws.data.sessionId ?? null,
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
      error: err.message,
      eventType: getEventType(payload),
      reason,
      sessionId: ws.data.sessionId ?? null,
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
      `invalid_json${error instanceof Error ? `: ${error.message}` : ""}`,
      { cause: error }
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
    const timerStart = performance.now();
    let metricType = "unknown";
    try {
      // Binary Audio Chunk
      if (
        typeof message !== "string" &&
        (message instanceof Buffer ||
          message instanceof Uint8Array ||
          message instanceof ArrayBuffer)
      ) {
        metricType = "binary_audio";
        if (!ws.data.sessionId) {
          throw new Error("session_not_started");
        }
        if (!ws.data.inputMimeType) {
          throw new Error("input_mime_type_required");
        }

        const bytes =
          message instanceof ArrayBuffer
            ? message.byteLength
            : message.byteLength;
        voiceWebSocketBinaryChunkSizeBytes.observe(bytes);
        if (bytes > MAX_WS_BINARY_BYTES) {
          voiceWebSocketPayloadTooLargeTotal.inc();
          throw new Error("payload_too_large");
        }

        const inputMimeType = ws.data.inputMimeType ?? PCM_MIME_TYPE;
        await this.handleChunk(ws, {
          _: "audio_chunk",
          audioBase64: toBufferFromBinary(message).toString("base64"),
          emitPartial: true,
          mimeType: inputMimeType,
        });
        return;
      }

      const event = parseMessage(message);
      const kind =
        // oxlint-disable noExplicitAny: Generic event handling
        typeof (event as any)._ === "string"
          ? // oxlint-disable noExplicitAny: Generic event handling
            ((event as any)._ as string)
          : null;
      if (!kind) {
        throw new Error("event_type_missing");
      }
      metricType = kind;

      switch (kind) {
        case "start": {
          await this.handleStart(
            ws,
            event as unknown as VoiceStreamStartPayload
          );
          break;
        }
        case "audio_chunk": {
          await this.handleChunk(
            ws,
            event as unknown as VoiceStreamAudioChunkPayload
          );
          break;
        }
        case "stop": {
          await this.handleStop(
            ws,
            (event as unknown as VoiceStreamStopPayload).reason ?? "manual"
          );
          break;
        }
        case "ping": {
          this.sendWithErrorHandling(ws, {
            _: "pong",
            sessionId: ws.data.sessionId ?? null,
          });
          break;
        }

        case "telemetry_report": {
          const report = event as unknown as Extract<
            VoiceStreamServerEvent,
            { _: "telemetry_report" }
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

        default: {
          throw new Error(`unknown_event_type:${kind}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      send(ws, {
        _: "error",
        message: msg,
        sessionId: ws.data.sessionId ?? null,
      });
    } finally {
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceWebSocketMessageLatencySeconds.observe(
        { message_type: metricType },
        wallSeconds
      );
    }
  }

  private async handleStart(
    ws: ServerWebSocket<VoiceSocketData>,
    payload: VoiceStreamStartPayload
  ) {
    const sessionId = payload.sessionId || randomUUID();
    const { language } = payload;
    const { userId } = ws.data;

    // Create processing session
    this.sessionRegistry.removeSession(sessionId);
    const session = this.sessionRegistry.createSession(
      userId,
      sessionId,
      language
    );

    const requestedCodec = normalizeCodec(payload.codec);
    const negotiatedCodec = requestedCodec; // Simplified negotiation

    const ttsFormat = (payload.ttsFormat as "mp3" | "opus" | "wav") || "mp3";

    // Registry hook
    const registryId = await this.hooks.onSessionStart(userId, sessionId, {
      codec: requestedCodec,
      negotiatedCodec,
      surface: payload.surface ?? "stream",
      ttsFormat,
    });

    // Update socket data
    ws.data.sessionId = sessionId;
    ws.data.sessionRegistryId = registryId;
    ws.data.language = language;
    ws.data.inputMimeType = payload.inputMimeType;
    ws.data.codec = requestedCodec;
    ws.data.negotiatedCodec = negotiatedCodec;
    ws.data.sttChunkSize = payload.sttChunkSize;
    ws.data.needsSttCacheClear = true;
    ws.data.vadThreshold = payload.vadThreshold;
    ws.data.autoStop = payload.autoStop !== false;
    ws.data.maxUtteranceMs = payload.maxUtteranceMs ?? 20_000;
    ws.data.ttsVoice = payload.ttsVoice;
    ws.data.ttsFormat = ttsFormat;
    ws.data.ttsInProgress = false;
    ws.data.ttsAbortToken = 0;

    if (payload.sttChunkSize) {
      session.setChunkSize(payload.sttChunkSize);
    }

    this.sendWithErrorHandling(ws, {
      _: "session_started",
      codec: requestedCodec,
      inputMimeType: ws.data.inputMimeType,
      negotiatedCodec,
      protocolVersion: 1,
      sessionId,
      ttsFormat,
    });

    await this.updateStatus(ws, "recording");
  }

  private async handleChunk(
    ws: ServerWebSocket<VoiceSocketData>,
    payload: VoiceStreamAudioChunkPayload
  ) {
    const { sessionId } = ws.data;
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

    if (ws.data.ttsInProgress) {
      ws.data.ttsAbortToken = (ws.data.ttsAbortToken ?? 0) + 1;
      this.sendWithErrorHandling(ws, { _: "interrupt", sessionId });
      await this.updateStatus(ws, "recording");
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
        ({ mimeType } = decoded);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ws.data.sessionRegistryId) {
          await this.hooks.onSessionError(ws.data.sessionRegistryId, msg);
        }
        this.sendWithErrorHandling(ws, {
          _: "error",
          message: msg,
          sessionId,
        });
        return;
      }
    }

    const shouldClearCache = ws.data.needsSttCacheClear === true;
    const result = await session.processAudioChunk(
      processedAudioBase64,
      mimeType,
      {
        chunkSize: ws.data.sttChunkSize,
        clearCache: shouldClearCache,
        sessionId,
        vadThreshold: ws.data.vadThreshold,
      }
    );
    if (shouldClearCache) {
      ws.data.needsSttCacheClear = false;
    }

    if (!ws.data.utteranceStartedAt) {
      ws.data.utteranceStartedAt = Date.now();
    }

    if (payload.emitPartial !== false) {
      const transcript = session.getTranscript();
      this.sendWithErrorHandling(ws, {
        _: "partial_transcript",
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
        _: "vad_state",
        sessionId,
        // oxlint-disable noExplicitAny: Internal result property
        vadConfidence: (result as any).vadConfidence ?? null,
        // oxlint-disable noExplicitAny: Internal result property
        isEmpty: (result as any).isEmpty ?? null,
        // oxlint-disable noExplicitAny: Internal result property
        endOfUtterance: (result as any).endOfUtterance ?? null,
      });

      if (ws.data.autoStop && result.endOfUtterance) {
        this.sendWithErrorHandling(ws, {
          _: "auto_stop",
          reason: "silence",
          sessionId,
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
        _: "auto_stop",
        reason: "timeout",
        sessionId,
      });
      await this.handleStop(ws, "timeout");
      return;
    }
  }

  private async handleStop(
    ws: ServerWebSocket<VoiceSocketData>,
    _reason: "manual" | "silence" | "timeout"
  ) {
    const { sessionId } = ws.data;
    if (!sessionId) {
      return;
    }

    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) {
      return;
    }

    const transcript = session.getTranscript();
    this.sendWithErrorHandling(ws, {
      _: "final_transcript",
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

    // Prepare for next utterance:
    // - keep the session alive for reuse on the same socket
    // - clear transcript buffer
    // - ensure Nemotron streaming cache is cleared on the next chunk
    session.clearUtterance();
    ws.data.needsSttCacheClear = true;
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
      const assistantWallSeconds =
        (performance.now() - assistantTimerStart) / 1000;
      // Use hook-provided duration if available, otherwise fall back to wall-clock time
      const durationSeconds = assistant.durationSeconds ?? assistantWallSeconds;
      recordVoiceAssistant({
        durationSeconds,
        provider: assistantProvider,
        status: "ok",
      });
      voiceStreamLatencySeconds.observe(
        { stage: "assistant" },
        durationSeconds
      );

      const rawParsed = parseVoiceAssistantRaw(assistant.raw);
      if (!rawParsed.ok && assistant.raw !== undefined) {
        logger.warn("voice_assistant_raw_invalid", {
          error: rawParsed.error,
          sessionId,
        });
      }

      this.sendWithErrorHandling(ws, {
        _: "assistant_message",
        raw: rawParsed.ok ? rawParsed.value : undefined,
        replayId: assistant.replayId ?? null,
        sessionId,
        text: assistant.text,
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
        _: "error",
        message: msg,
        sessionId: ws.data.sessionId ?? null,
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

    const { sessionId } = ws.data;
    if (!sessionId) {
      throw new Error("session_id_missing");
    }
    // const sequence = 0;
    ws.data.ttsInProgress = true;
    ws.data.ttsAbortToken = (ws.data.ttsAbortToken ?? 0) + 1;
    const token = ws.data.ttsAbortToken;
    await this.updateStatus(ws, "playing");

    const negotiatedCodec = ws.data.negotiatedCodec ?? "pcm";
    const targetFormat = codecToFormat[negotiatedCodec as StreamCodec];

    try {
      await session.streamSynthesis(text, ws.data.ttsVoice, async (chunk) => {
        if (ws.data.ttsAbortToken !== token) {
          return;
        }
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
        } catch {
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

      if (ws.data.ttsAbortToken === token) {
        this.sendWithErrorHandling(ws, { _: "tts_complete", sessionId });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (ws.data.sessionRegistryId) {
        await this.hooks.onSessionError(ws.data.sessionRegistryId, msg);
      }
      this.sendWithErrorHandling(ws, {
        _: "error",
        message: msg,
        sessionId: ws.data.sessionId ?? null,
      });
    } finally {
      const aborted = ws.data.ttsAbortToken !== token;
      ws.data.ttsInProgress = false;
      if (!aborted) {
        if (ws.data.sessionRegistryId) {
          await this.hooks.onSessionComplete(ws.data.sessionRegistryId);
        }
        await this.updateStatus(ws, "idle");
      }
      // Now we can optionally clean up session if needed, or wait for inactivity
    }
  }

  private async updateStatus(
    ws: ServerWebSocket<VoiceSocketData>,
    state: "recording" | "processing" | "playing" | "idle"
  ) {
    const statusMap = {
      idle: "idle",
      playing: "responding",
      processing: "processing",
      recording: "recording",
    } as const;
    const { sessionId } = ws.data;
    if (sessionId) {
      this.sendWithErrorHandling(ws, {
        _: "status",
        sessionId,
        state,
      });
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
