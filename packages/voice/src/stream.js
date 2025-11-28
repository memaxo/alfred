 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }

















































const SESSION_START_TIMEOUT_MS = 10000;

const isReactNative =
  typeof navigator !== "undefined" &&
  (navigator ).product === "ReactNative";
const isNodeEnvironment =
  typeof globalThis !== "undefined" &&
  !("window" in globalThis) &&
  typeof process !== "undefined" &&
  !!_optionalChain([process, 'access', _ => _.versions, 'optionalAccess', _2 => _2.node]);

function createSocket(
  url,
  protocols,
  headers
) {
  const Impl = WebSocket;
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
      return new TextDecoder().decode(buffer );
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
  
  
   __init() {this.socket = null}
   __init2() {this.connectionPromise = null}
   __init3() {this.sessionPromise = null}
   __init4() {this.resolveSession = null}
   __init5() {this.rejectSession = null}
   __init6() {this.sessionTimer = null}
  
   __init7() {this.closed = false}

  constructor(
    options,
    handlers = {}
  ) {;VoiceStreamClient.prototype.__init.call(this);VoiceStreamClient.prototype.__init2.call(this);VoiceStreamClient.prototype.__init3.call(this);VoiceStreamClient.prototype.__init4.call(this);VoiceStreamClient.prototype.__init5.call(this);VoiceStreamClient.prototype.__init6.call(this);VoiceStreamClient.prototype.__init7.call(this);
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
    return _optionalChain([this, 'access', _3 => _3.socket, 'optionalAccess', _4 => _4.readyState]) === WebSocket.OPEN;
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

  async sendTelemetry(metrics



) {
    if (!(this.isConnected() && this.sessionId)) {
      return;
    }
    this.send({
      type: "telemetry_report",
      sessionId: this.sessionId,
      ...metrics,
    });
  }

  async stop(
    reason = "manual"
  ) {
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
    }, _nullishCoalesce(this.options.sessionTimeoutMs, () => ( SESSION_START_TIMEOUT_MS)));
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
            (ws ).binaryType = "arraybuffer";
          } catch (e) {
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
            const audioBase64 = Buffer.from(event.data ).toString(
              "base64"
            );
            _optionalChain([this, 'access', _5 => _5.handlers, 'access', _6 => _6.onTtsChunk, 'optionalCall', _7 => _7({
              type: "tts_chunk",
              sessionId: _nullishCoalesce(this.sessionId, () => ( "")),
              audioBase64,
              mimeType: "audio/pcm",
              sequence: 0,
              isLast: false,
            })]);
            return;
          }

          try {
            const text = normalizeMessageData(event.data);
            if (!text) {
              return;
            }
            const parsed = JSON.parse(text) ;
            this.handleServerEvent(parsed);
          } catch (error) {
            _optionalChain([this, 'access', _8 => _8.options, 'access', _9 => _9.logger, 'optionalCall', _10 => _10("message_parse_failed", {
              error: error instanceof Error ? error.message : String(error),
            })]);
          }
        };
        ws.onerror = () => {
          const err = new Error("voice_stream_socket_error");
          _optionalChain([this, 'access', _11 => _11.handlers, 'access', _12 => _12.onError, 'optionalCall', _13 => _13({
            type: "error",
            sessionId: _nullishCoalesce(this.sessionId, () => ( null)),
            message: err.message,
          })]);
          if (!this.isConnected()) {
            reject(err);
          }
        };
        ws.onclose = (event) => {
          this.connectionPromise = null;
          this.sessionId = undefined;
          if (!this.closed) {
            _optionalChain([this, 'access', _14 => _14.handlers, 'access', _15 => _15.onClose, 'optionalCall', _16 => _16(event.code, event.reason)]);
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
        _optionalChain([this, 'access', _17 => _17.handlers, 'access', _18 => _18.onReady, 'optionalCall', _19 => _19(event)]);
        return;
      case "session_started":
        this.sessionId = event.sessionId;
        _optionalChain([this, 'access', _20 => _20.handlers, 'access', _21 => _21.onSessionStarted, 'optionalCall', _22 => _22(event)]);
        this.resolvePendingSession(event.sessionId);
        return;
      case "partial_transcript":
        _optionalChain([this, 'access', _23 => _23.handlers, 'access', _24 => _24.onPartialTranscript, 'optionalCall', _25 => _25(event)]);
        return;
      case "final_transcript":
        _optionalChain([this, 'access', _26 => _26.handlers, 'access', _27 => _27.onFinalTranscript, 'optionalCall', _28 => _28(event)]);
        return;
      case "vad_state":
        _optionalChain([this, 'access', _29 => _29.handlers, 'access', _30 => _30.onVadState, 'optionalCall', _31 => _31(event)]);
        return;
      case "auto_stop":
        _optionalChain([this, 'access', _32 => _32.handlers, 'access', _33 => _33.onAutoStop, 'optionalCall', _34 => _34(event)]);
        return;
      case "assistant_message":
        _optionalChain([this, 'access', _35 => _35.handlers, 'access', _36 => _36.onAssistantMessage, 'optionalCall', _37 => _37(event)]);
        return;
      case "tts_chunk":
        _optionalChain([this, 'access', _38 => _38.handlers, 'access', _39 => _39.onTtsChunk, 'optionalCall', _40 => _40(event)]);
        return;
      case "tts_complete":
        _optionalChain([this, 'access', _41 => _41.handlers, 'access', _42 => _42.onTtsComplete, 'optionalCall', _43 => _43(event)]);
        return;
      case "interrupt":
        _optionalChain([this, 'access', _44 => _44.handlers, 'access', _45 => _45.onInterrupt, 'optionalCall', _46 => _46(event)]);
        return;
      case "status":
        _optionalChain([this, 'access', _47 => _47.handlers, 'access', _48 => _48.onStatus, 'optionalCall', _49 => _49(event)]);
        return;
      case "error":
        _optionalChain([this, 'access', _50 => _50.handlers, 'access', _51 => _51.onError, 'optionalCall', _52 => _52(event)]);
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
