import type { UIMessage } from "ai";

export type VoiceStreamCodec = "pcm" | "mp3" | "opus" | "wav";
export type VoiceStreamSurface =
  | "drive"
  | "carplay"
  | "web"
  | "native"
  | "stream"
  | "unknown";

/**
 * Canonical rich payload for voice assistant responses.
 *
 * This is transported via `VoiceStreamServerEvent._ === "assistant_message"` as `raw`.
 * It is designed to be AI SDK v6-compatible (UIMessage parts), so all surfaces can
 * render GenUI and tool results consistently.
 */
export interface VoiceAssistantRaw {
  uiMessages: UIMessage[];
  meta?: {
    runId?: string;
    planId?: string;
    [key: string]: unknown;
  };
}

export interface VoiceStreamStartPayload {
  _: "start";
  /**
   * Version of the realtime voice protocol.
   * Optional for backwards compatibility; defaults to 1 when omitted.
   */
  protocolVersion?: number;
  sessionId?: string;
  language?: string;
  /**
   * MIME type of incoming audio chunks.
   * Required when the client sends binary frames, since binary frames carry no metadata.
   */
  inputMimeType?: string;
  codec?: VoiceStreamCodec;
  surface?: VoiceStreamSurface;
  vadThreshold?: number;
  /**
   * STT chunk size for latency/accuracy tradeoff (Nemotron streaming).
   * - fast: 80ms
   * - low: 160ms
   * - medium: 560ms (default)
   * - accurate: 1.12s
   */
  sttChunkSize?: "fast" | "low" | "medium" | "accurate";
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
}

export interface VoiceStreamAudioChunkPayload {
  _: "audio_chunk";
  audioBase64?: string;
  audio?: Uint8Array | ArrayBuffer; // Binary support
  mimeType: string;
  emitPartial?: boolean;
}

export interface VoiceStreamStopPayload {
  _: "stop";
  reason?: "manual" | "silence" | "timeout";
}

export interface VoiceStreamStatusEvent {
  _: "status";
  sessionId: string | null;
  state: "recording" | "processing" | "playing" | "idle";
}

export interface VoiceStreamAutoStopEvent {
  _: "auto_stop";
  sessionId: string;
  reason: "manual" | "silence" | "timeout";
}

export type VoiceStreamServerEvent =
  | { _: "ready"; sessionId: null; protocolVersion?: number }
  | {
      _: "session_started";
      sessionId: string;
      codec: VoiceStreamCodec;
      negotiatedCodec: VoiceStreamCodec;
      protocolVersion?: number;
      inputMimeType?: string;
      ttsFormat?: "mp3" | "opus" | "wav";
    }
  | {
      _: "partial_transcript";
      sessionId: string;
      text: string;
    }
  | {
      _: "final_transcript";
      sessionId: string;
      text: string;
    }
  | {
      _: "vad_state";
      sessionId: string;
      vadConfidence: number | null;
      isEmpty: boolean | null;
      endOfUtterance: boolean | null;
    }
  | VoiceStreamAutoStopEvent
  | { _: "interrupt"; sessionId: string }
  | {
      _: "assistant_message";
      sessionId: string;
      text: string;
      replayId?: string | null;
      raw?: VoiceAssistantRaw;
    }
  | {
      _: "tts_chunk";
      sessionId: string;
      audioBase64: string;
      mimeType: string;
      sequence: number;
      isLast?: boolean;
    }
  | { _: "tts_complete"; sessionId: string }
  | VoiceStreamStatusEvent
  | {
      _: "error";
      sessionId: string | null;
      message: string;
      code?: string;
    }
  | { _: "pong"; sessionId?: string | null }
  | {
      _: "telemetry_report";
      sessionId: string;
      packetLoss: number;
      jitter: number;
      rtt: number;
      timestamp: number;
    };

export interface VoiceStreamInput {
  mode?: "clip" | "stream";
  sessionId?: string;
  language?: string;
}

export type VoiceStreamEvent = VoiceStreamServerEvent;
