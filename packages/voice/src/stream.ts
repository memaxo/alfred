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
  onReady?(event: Extract<VoiceStreamServerEvent, { type: "ready" }>): void;
  onSessionStarted?(
    event: Extract<VoiceStreamServerEvent, { type: "session_started" }>
  ): void;
  onPartialTranscript?(
    event: Extract<VoiceStreamServerEvent, { type: "partial_transcript" }>
  ): void;
  onFinalTranscript?(
    event: Extract<VoiceStreamServerEvent, { type: "final_transcript" }>
  ): void;
  onVadState?(
    event: Extract<VoiceStreamServerEvent, { type: "vad_state" }>
  ): void;
  onAutoStop?(event: VoiceStreamAutoStopEvent): void;
  onAssistantMessage?(
    event: Extract<VoiceStreamServerEvent, { type: "assistant_message" }>
  ): void;
  onTtsChunk?(
    event: Extract<VoiceStreamServerEvent, { type: "tts_chunk" }>
  ): void;
  onTtsComplete?(
    event: Extract<VoiceStreamServerEvent, { type: "tts_complete" }>
  ): void;
  onInterrupt?(event: { type: "interrupt"; sessionId: string }): void;
  onStatus?(event: VoiceStreamStatusEvent): void;
  onError?(event: Extract<VoiceStreamServerEvent, { type: "error" }>): void;
  onClose?(code: number, reason: string): void;
};

const SESSION_START_TIMEOUT_MS = 10_000;

const isReactNative =
  typeof navigator !== "undefined" &&
  "product" in navigator &&
  (navigator as Navigator & { product?: unknown }).product === "ReactNative";
const isNodeEnvironment =
  typeof globalThis !== "undefined" &&
  !("window" in globalThis) &&
  typeof process !== "undefined" &&
  !!process.versions?.node;

function createSocket(
  url: string,
  protocols?: string | string[],
  headers?: Record<string, string>
): WebSocket {
  type NodeWsCtor = new (
    url: string,
    options: { headers?: Record<string, string>; protocol?: string }
  ) => WebSocket;
  type StandardWsCtor = new (
    url: string,
    protocols?: string | string[]
  ) => WebSocket;
  type ReactNativeWsCtor = new (
    url: string,
    protocols?: string | string[],
    options?: { headers?: Record<string, string> }
  ) => WebSocket;

  const Impl = WebSocket as unknown as NodeWsCtor &
    StandardWsCtor &
    ReactNativeWsCtor;
  const hasHeaders = headers && Object.keys(headers).length > 0;

  if (isNodeEnvironment && hasHeaders) {
    return new Impl(url, {
      headers,
      protocol: Array.isArray(protocols) ? protocols.join(",") : protocols,
    });
  }

  if (isReactNative && hasHeaders) {
    return new Impl(url, protocols, { headers });
  }

  return new Impl(url, protocols);
}

function normalizeMessageData(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (
    typeof ArrayBuffer !== "undefined" &&
    (data instanceof ArrayBuffer || ArrayBuffer.isView(data))
  ) {
    const buffer = data instanceof ArrayBuffer ? data : data.buffer;
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(buffer);
    }
    const bytes = new Uint8Array(buffer);
    let result = "";
    for (const byte of bytes) {
      result += String.fromCharCode(byte);
    }
    return result;
  }
  return "";
}

export class VoiceStreamClient {
  private readonly options: VoiceStreamClientOptions;
  private readonly handlers: VoiceStreamClientHandlers;
  private socket: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private sessionPromise: Promise<string> | null = null;
  private resolveSession: ((id: string) => void) | null = null;
  private rejectSession: ((error: Error) => void) | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | undefined;
  private closed = false;

  constructor(
    options: VoiceStreamClientOptions,
    handlers: VoiceStreamClientHandlers = {}
  ) {
    if (!options.url) {
      throw new Error("voice_stream_url_required");
    }
    this.options = options;
    this.handlers = handlers;
  }

  get currentSessionId(): string | undefined {
    return this.sessionId;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async startSession(overrides?: Partial<StartPayload>): Promise<string> {
    await this.ensureConnection();
    if (this.sessionPromise) {
      return this.sessionPromise;
    }
    this.sessionPromise = new Promise<string>((resolve, reject) => {
      this.resolveSession = resolve;
      this.rejectSession = reject;
    });
    const payload: VoiceStreamStartPayload = {
      type: "start",
      ...this.options.start,
      ...overrides,
    };
    this.send(payload);
    this.startSessionTimer();
    return this.sessionPromise;
  }

  async sendAudioChunk(payload: AudioChunkPayload): Promise<void> {
    await this.ensureConnection();
    if (!(this.sessionId || this.sessionPromise)) {
      throw new Error("voice_stream_session_not_started");
    }

    if (payload.audio) {
      // Send raw binary
      this.send(payload.audio);
    } else if (payload.audioBase64) {
      const buffer = Buffer.from(payload.audioBase64, "base64");
      this.send(buffer);
    } else {
      // Fallback or error
      throw new Error("audio_payload_empty");
    }
  }

  sendTelemetry(metrics: {
    packetLoss: number;
    jitter: number;
    rtt: number;
  }): Promise<void> {
    if (!(this.isConnected() && this.sessionId)) {
      return Promise.resolve();
    }
    this.send({
      type: "telemetry_report",
      sessionId: this.sessionId,
      ...metrics,
      timestamp: Date.now(),
    });
    return Promise.resolve();
  }

  async stop(
    reason: "manual" | "silence" | "timeout" = "manual"
  ): Promise<void> {
    await this.ensureConnection();
    this.send({ type: "stop", reason });
  }

  close(): Promise<void> {
    this.closed = true;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = null;
    this.rejectPendingSession(new Error("voice_stream_socket_closed"));
    this.clearSessionTimer();
    return Promise.resolve();
  }

  private rejectPendingSession(error: Error) {
    if (this.rejectSession) {
      this.rejectSession(error);
    }
    this.sessionPromise = null;
    this.resolveSession = null;
    this.rejectSession = null;
    this.clearSessionTimer();
  }

  private resolvePendingSession(sessionId: string) {
    if (this.resolveSession) {
      this.resolveSession(sessionId);
    }
    this.sessionPromise = null;
    this.resolveSession = null;
    this.rejectSession = null;
    this.clearSessionTimer();
  }

  private startSessionTimer() {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => {
      const error = new Error("voice_stream_session_timeout");
      this.rejectPendingSession(error);
    }, this.options.sessionTimeoutMs ?? SESSION_START_TIMEOUT_MS);
  }

  private clearSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private send(payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("voice_stream_socket_not_ready");
    }
    try {
      if (
        payload instanceof ArrayBuffer ||
        payload instanceof Uint8Array ||
        payload instanceof Buffer
      ) {
        this.socket.send(payload);
      } else {
        this.socket.send(JSON.stringify(payload));
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private ensureConnection(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    if (this.closed) {
      throw new Error("voice_stream_client_closed");
    }
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const ws = createSocket(
          this.options.url,
          this.options.protocols,
          this.options.headers
        );
        this.socket = ws;
        if ("binaryType" in ws) {
          try {
            (ws as WebSocket).binaryType = "arraybuffer";
          } catch {
            // Ignore when not supported (e.g., React Native polyfill)
          }
        }
        ws.onopen = () => {
          resolve();
        };
        ws.onmessage = (event) => {
          if (
            event.data instanceof ArrayBuffer ||
            event.data instanceof Buffer
          ) {
            const bytes =
              event.data instanceof ArrayBuffer
                ? new Uint8Array(event.data)
                : event.data;
            const audioBase64 = Buffer.from(bytes).toString("base64");
            this.handlers.onTtsChunk?.({
              type: "tts_chunk",
              sessionId: this.sessionId ?? "",
              audioBase64,
              mimeType: "audio/pcm",
              sequence: 0,
              isLast: false,
            });
            return;
          }

          try {
            const text = normalizeMessageData(event.data);
            if (!text) {
              return;
            }
            const parsed = JSON.parse(text) as VoiceStreamServerEvent;
            this.handleServerEvent(parsed);
          } catch (error) {
            this.options.logger?.("message_parse_failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };
        ws.onerror = () => {
          const err = new Error("voice_stream_socket_error");
          this.handlers.onError?.({
            type: "error",
            sessionId: this.sessionId ?? null,
            message: err.message,
          });
          if (!this.isConnected()) {
            reject(err);
          }
        };
        ws.onclose = (event) => {
          this.connectionPromise = null;
          this.sessionId = undefined;
          if (!this.closed) {
            this.handlers.onClose?.(event.code, event.reason);
          }
          this.rejectPendingSession(
            new Error(event.reason || "voice_stream_socket_closed")
          );
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    return this.connectionPromise;
  }

  private handleServerEvent(event: VoiceStreamServerEvent) {
    switch (event.type) {
      case "ready":
        this.handlers.onReady?.(event);
        return;
      case "session_started":
        this.sessionId = event.sessionId;
        this.handlers.onSessionStarted?.(event);
        this.resolvePendingSession(event.sessionId);
        return;
      case "partial_transcript":
        this.handlers.onPartialTranscript?.(event);
        return;
      case "final_transcript":
        this.handlers.onFinalTranscript?.(event);
        return;
      case "vad_state":
        this.handlers.onVadState?.(event);
        return;
      case "auto_stop":
        this.handlers.onAutoStop?.(event);
        return;
      case "assistant_message":
        this.handlers.onAssistantMessage?.(event);
        return;
      case "tts_chunk":
        this.handlers.onTtsChunk?.(event);
        return;
      case "tts_complete":
        this.handlers.onTtsComplete?.(event);
        return;
      case "interrupt":
        this.handlers.onInterrupt?.(event);
        return;
      case "status":
        this.handlers.onStatus?.(event);
        return;
      case "error":
        this.handlers.onError?.(event);
        if (!this.sessionId) {
          this.rejectPendingSession(
            new Error(event.message || "voice_stream_error")
          );
        }
        return;
      case "pong":
        return;
      case "telemetry_report":
        // Ignore, server only
        return;
      default:
        return;
    }
  }
}
