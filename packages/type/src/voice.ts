export type VoiceStreamCodec = "pcm" | "mp3" | "opus" | "wav";
export type VoiceStreamSurface = "drive" | "carplay" | "web" | "native" | "stream" | "unknown";

export interface VoiceStreamStartPayload {
  type: "start";
  sessionId?: string;
  language?: string;
  codec?: VoiceStreamCodec;
  surface?: VoiceStreamSurface;
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
}

export interface VoiceStreamAudioChunkPayload {
  type: "audio_chunk";
  audioBase64: string;
  mimeType: string;
  emitPartial?: boolean;
}

export interface VoiceStreamStopPayload {
  type: "stop";
  reason?: "manual" | "silence" | "timeout";
}

export interface VoiceStreamStatusEvent {
  type: "status";
  sessionId: string | null;
  state: "recording" | "processing" | "playing" | "idle";
}

export interface VoiceStreamAutoStopEvent {
  type: "auto_stop";
  sessionId: string;
  reason: "manual" | "silence" | "timeout";
}

export type VoiceStreamServerEvent =
  | { type: "ready"; sessionId: null }
  | {
      type: "session_started";
      sessionId: string;
      codec: VoiceStreamCodec;
      negotiatedCodec: VoiceStreamCodec;
    }
  | {
      type: "partial_transcript";
      sessionId: string;
      text: string;
    }
  | {
      type: "final_transcript";
      sessionId: string;
      text: string;
    }
  | {
      type: "vad_state";
      sessionId: string;
      vadConfidence: number | null;
      isEmpty: boolean | null;
      endOfUtterance: boolean | null;
    }
  | VoiceStreamAutoStopEvent
  | {
      type: "assistant_message";
      sessionId: string;
      text: string;
      replayId?: string | null;
      raw?: unknown;
    }
  | {
      type: "tts_chunk";
      sessionId: string;
      audioBase64: string;
      mimeType: string;
      sequence: number;
      isLast?: boolean;
    }
  | { type: "tts_complete"; sessionId: string }
  | VoiceStreamStatusEvent
  | {
      type: "error";
      sessionId: string | null;
      message: string;
      code?: string;
    }
  | { type: "pong"; sessionId?: string | null };

export interface VoiceStreamInput {
  mode?: "clip" | "stream";
  sessionId?: string;
  language?: string;
}

export type VoiceStreamEvent = VoiceStreamServerEvent;
