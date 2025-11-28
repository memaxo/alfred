 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }













const DEFAULT_VOICE = "alloy";
const DEFAULT_FORMAT = "mp3";

export class VoiceSessionError extends Error {
  
  constructor(
    message,
    options
  ) {
    super(message, _optionalChain([options, 'optionalAccess', _ => _.cause]) ? { cause: options.cause } : undefined);
    this.name = "VoiceSessionError";
    this.clip = _optionalChain([options, 'optionalAccess', _2 => _2.clip]);
  }
}

function now() {
  return Date.now();
}

function updateState(
  state,
  patch
) {
  Object.assign(state, patch, { lastUpdated: now() });
}

function wrapError(error) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "voice_session_error");
}

export function createVoiceSession(
  adapter,
  client,
  options = {}
) {
  const state = {
    capture: "idle",
    transcript: "",
    error: null,
    lastUpdated: now(),
  };

  const defaults = {
    voice: _nullishCoalesce(options.defaultVoice, () => ( DEFAULT_VOICE)),
    format: _nullishCoalesce(options.defaultFormat, () => ( DEFAULT_FORMAT)),
  };

  let recordingActive = false;

  const ensureRecording = () => {
    if (!recordingActive) {
      throw new Error("voice_session_not_recording");
    }
  };

  const finishCapture = async () => {
    const clip = await adapter.stopCapture();
    recordingActive = false;
    if (!_optionalChain([clip, 'optionalAccess', _3 => _3.audioBase64])) {
      updateState(state, {
        capture: "idle",
        error: "capture_empty",
      });
      return null;
    }
    return clip;
  };

  const start = async () => {
    if (recordingActive) {
      return;
    }
    try {
      await _optionalChain([adapter, 'access', _4 => _4.configureSession, 'optionalCall', _5 => _5({ background: false })]);
      await adapter.startCapture();
      recordingActive = true;
      updateState(state, { capture: "recording", error: null, transcript: "" });
    } catch (error) {
      recordingActive = false;
      const wrapped = wrapError(error);
      updateState(state, { capture: "idle", error: wrapped.message });
      throw wrapped;
    }
  };

  const stopAndTranscribe = async (
    overrides
  ) => {
    ensureRecording();
    updateState(state, { capture: "processing", error: null });
    const clip = await finishCapture();
    if (!clip) {
      return null;
    }
    const payload = {
      audioBase64: clip.audioBase64,
      mimeType: clip.mimeType,
      language: _optionalChain([overrides, 'optionalAccess', _6 => _6.language]),
      model: _optionalChain([overrides, 'optionalAccess', _7 => _7.model]),
      prompt: _optionalChain([overrides, 'optionalAccess', _8 => _8.prompt]),
    };
    try {
      const result = await client.sttTranscribe(payload);
      updateState(state, {
        capture: "complete",
        transcript: _nullishCoalesce(_optionalChain([result, 'optionalAccess', _9 => _9.text]), () => ( "")),
        error: null,
      });
      return result;
    } catch (error) {
      const wrapped = wrapError(error);
      updateState(state, { capture: "idle", error: wrapped.message });
      throw wrapped;
    }
  };

  const speak = async (input) => {
    try {
      const payload = {
        text: input.text,
        voice: _nullishCoalesce(input.voice, () => ( defaults.voice)),
        format: _nullishCoalesce(input.format, () => ( defaults.format)),
        model: input.model,
      };
      const result = await client.ttsSynthesize(payload);
      await adapter.play(result.audioBase64, result.mimeType);
    } catch (error) {
      const wrapped = wrapError(error);
      updateState(state, { error: wrapped.message });
      throw wrapped;
    }
  };

  const speechToSpeech = async (
    overrides
  ) => {
    if (!client.speechToSpeech) {
      throw new Error("speech_to_speech_unavailable");
    }
    ensureRecording();
    updateState(state, { capture: "processing", error: null });
    let clip = null;
    try {
      const captured = await finishCapture();
      if (!captured) {
        return null;
      }
      clip = captured;
      const payload = {
        audioBase64: captured.audioBase64,
        mimeType: captured.mimeType,
        language: _optionalChain([overrides, 'optionalAccess', _10 => _10.language]),
        prompt: _optionalChain([overrides, 'optionalAccess', _11 => _11.prompt]),
        thread: _optionalChain([overrides, 'optionalAccess', _12 => _12.thread]),
        resource: _optionalChain([overrides, 'optionalAccess', _13 => _13.resource]),
        sttModel: _optionalChain([overrides, 'optionalAccess', _14 => _14.sttModel]),
        ttsModel: _optionalChain([overrides, 'optionalAccess', _15 => _15.ttsModel]),
        ttsVoice: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _16 => _16.ttsVoice]), () => ( defaults.voice)),
        ttsFormat: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _17 => _17.ttsFormat]), () => ( defaults.format)),
        sessionId: _optionalChain([overrides, 'optionalAccess', _18 => _18.sessionId]),
        surface: _optionalChain([overrides, 'optionalAccess', _19 => _19.surface]),
        inputCodec: captured.mimeType,
        outputCodec: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _20 => _20.ttsFormat]), () => ( defaults.format)),
      };
      const result = await client.speechToSpeech(payload);
      if (_optionalChain([result, 'optionalAccess', _21 => _21.transcript, 'optionalAccess', _22 => _22.text])) {
        updateState(state, {
          transcript: result.transcript.text,
          capture: "complete",
        });
      } else {
        updateState(state, { capture: "complete" });
      }
      if (_optionalChain([result, 'optionalAccess', _23 => _23.audio, 'optionalAccess', _24 => _24.audioBase64])) {
        await adapter.play(result.audio.audioBase64, result.audio.mimeType);
      }
      return result;
    } catch (error) {
      const wrapped = wrapError(error);
      updateState(state, { capture: "idle", error: wrapped.message });
      throw new VoiceSessionError(wrapped.message, {
        clip: _nullishCoalesce(clip, () => ( undefined)),
        cause: error instanceof Error ? error : undefined,
      });
    }
  };

  const clear = () => {
    updateState(state, { capture: "idle", transcript: "", error: null });
  };

  return {
    state,
    start,
    stopAndTranscribe,
    speak,
    speechToSpeech,
    clear,
  };
}
