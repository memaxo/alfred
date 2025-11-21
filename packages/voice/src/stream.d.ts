import type {
  VoiceStreamAudioChunkPayload,
  VoiceStreamAutoStopEvent,
  VoiceStreamServerEvent,
  VoiceStreamStartPayload,
  VoiceStreamStatusEvent,
} from "@alfred/type/voice";
type StartPayload = Omit<VoiceStreamStartPayload, "type">;
type AudioChunkPayload = Omit<VoiceStreamAudioChunkPayload, "type">;
export type VoiceStreamClientOptions = {
  url: string;
  start?: Partial<StartPayload>;
  headers?: Record<string, string>;
  protocols?: string | string[];
  logger?: (event: string, context?: Record<string, unknown>) => void;
  sessionTimeoutMs?: number;
};
export type VoiceStreamClientHandlers = {
  onReady?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "ready";
      }
    >
  ): void;
  onSessionStarted?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "session_started";
      }
    >
  ): void;
  onPartialTranscript?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "partial_transcript";
      }
    >
  ): void;
  onFinalTranscript?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "final_transcript";
      }
    >
  ): void;
  onVadState?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "vad_state";
      }
    >
  ): void;
  onAutoStop?(event: VoiceStreamAutoStopEvent): void;
  onAssistantMessage?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "assistant_message";
      }
    >
  ): void;
  onTtsChunk?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "tts_chunk";
      }
    >
  ): void;
  onTtsComplete?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "tts_complete";
      }
    >
  ): void;
  onInterrupt?(event: { type: "interrupt"; sessionId: string }): void;
  onStatus?(event: VoiceStreamStatusEvent): void;
  onError?(
    event: Extract<
      VoiceStreamServerEvent,
      {
        type: "error";
      }
    >
  ): void;
  onClose?(code: number, reason: string): void;
};
export declare class VoiceStreamClient {
  private readonly options;
  private readonly handlers;
  private socket;
  private connectionPromise;
  private sessionPromise;
  private resolveSession;
  private rejectSession;
  private sessionTimer;
  private sessionId;
  private closed;
  constructor(
    options: VoiceStreamClientOptions,
    handlers?: VoiceStreamClientHandlers
  );
  get currentSessionId(): string | undefined;
  isConnected(): boolean;
  startSession(overrides?: Partial<StartPayload>): Promise<string>;
  sendAudioChunk(payload: AudioChunkPayload): Promise<void>;
  sendTelemetry(metrics: {
    packetLoss: number;
    jitter: number;
    rtt: number;
  }): Promise<void>;
  stop(reason?: "manual" | "silence" | "timeout"): Promise<void>;
  close(): Promise<void>;
  private rejectPendingSession;
  private resolvePendingSession;
  private startSessionTimer;
  private clearSessionTimer;
  private send;
  private ensureConnection;
  private handleServerEvent;
}
