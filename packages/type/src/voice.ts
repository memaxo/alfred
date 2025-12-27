export type VoiceStreamCodec = "pcm" | "mp3" | "opus" | "wav";
export type VoiceStreamSurface =
  | "drive"
  | "carplay"
  | "web"
  | "native"
  | "stream"
  | "unknown";

export type VoiceStreamStartPayload = {
  _: "start";
  sessionId?: string;
  language?: string;
  codec?: VoiceStreamCodec;
  surface?: VoiceStreamSurface;
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
};

export type VoiceStreamAudioChunkPayload = {
  _: "audio_chunk";
  audioBase64?: string;
  audio?: Uint8Array | ArrayBuffer; // Binary support
  mimeType: string;
  emitPartial?: boolean;
};

export type VoiceStreamStopPayload = {
  _: "stop";
  reason?: "manual" | "silence" | "timeout";
};

export type VoiceStreamStatusEvent = {
  _: "status";
  sessionId: string | null;
  state: "recording" | "processing" | "playing" | "idle";
};

export type VoiceStreamAutoStopEvent = {
  _: "auto_stop";
  sessionId: string;
  reason: "manual" | "silence" | "timeout";
};

export type VoiceStreamServerEvent =
  | { _: "ready"; sessionId: null }
  | {
      _: "session_started";
      sessionId: string;
      codec: VoiceStreamCodec;
      negotiatedCodec: VoiceStreamCodec;
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
      raw?: unknown;
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

export type VoiceStreamInput = {
  mode?: "clip" | "stream";
  sessionId?: string;
  language?: string;
};

export type VoiceStreamEvent = VoiceStreamServerEvent;
