const SESSION_START_TIMEOUT_MS = 10_000;
const isReactNative =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";
function createSocket(url, protocols, headers) {
  const Impl = WebSocket;
  if (isReactNative && headers && Object.keys(headers).length > 0) {
    return new Impl(url, protocols, { headers });
  }
  return new Impl(url, protocols);
}
function normalizeMessageData(data) {
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
  options;
  handlers;
  socket = null;
  connectionPromise = null;
  sessionPromise = null;
  resolveSession = null;
  rejectSession = null;
  sessionTimer = null;
  sessionId;
  closed = false;
  constructor(options, handlers = {}) {
    if (!options.url) {
      throw new Error("voice_stream_url_required");
    }
    this.options = options;
    this.handlers = handlers;
  }
  get currentSessionId() {
    return this.sessionId;
  }
  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  async startSession(overrides) {
    await this.ensureConnection();
    if (this.sessionPromise) {
      return this.sessionPromise;
    }
    this.sessionPromise = new Promise((resolve, reject) => {
      this.resolveSession = resolve;
      this.rejectSession = reject;
    });
    const payload = {
      type: "start",
      ...this.options.start,
      ...overrides,
    };
    this.send(payload);
    this.startSessionTimer();
    return this.sessionPromise;
  }
  async sendAudioChunk(payload) {
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
  async sendTelemetry(metrics) {
    if (!(this.isConnected() && this.sessionId)) {
      return;
    }
    this.send({
      type: "telemetry_report",
      sessionId: this.sessionId,
      ...metrics,
    });
  }
  async stop(reason = "manual") {
    await this.ensureConnection();
    this.send({ type: "stop", reason });
  }
  async close() {
    this.closed = true;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = null;
    this.rejectPendingSession(new Error("voice_stream_socket_closed"));
    this.clearSessionTimer();
  }
  rejectPendingSession(error) {
    if (this.rejectSession) {
      this.rejectSession(error);
    }
    this.sessionPromise = null;
    this.resolveSession = null;
    this.rejectSession = null;
    this.clearSessionTimer();
  }
  resolvePendingSession(sessionId) {
    if (this.resolveSession) {
      this.resolveSession(sessionId);
    }
    this.sessionPromise = null;
    this.resolveSession = null;
    this.rejectSession = null;
    this.clearSessionTimer();
  }
  startSessionTimer() {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => {
      const error = new Error("voice_stream_session_timeout");
      this.rejectPendingSession(error);
    }, this.options.sessionTimeoutMs ?? SESSION_START_TIMEOUT_MS);
  }
  clearSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }
  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("voice_stream_socket_not_ready");
    }
    try {
      this.socket.send(JSON.stringify(payload));
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  ensureConnection() {
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
            ws.binaryType = "arraybuffer";
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
            const audioBase64 = Buffer.from(event.data).toString("base64");
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
            const parsed = JSON.parse(text);
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
  handleServerEvent(event) {
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
//# sourceMappingURL=stream.js.map
