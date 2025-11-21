import type {
  PlatformAdapter,
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  SttRequest,
  SttResult,
  TtsRequest,
  VoiceClient,
  VoiceSession,
  VoiceSessionOptions,
  VoiceSessionState,
  VoiceCapturedClip,
} from "./types";

const DEFAULT_VOICE = "alloy";
const DEFAULT_FORMAT = "mp3";

export class VoiceSessionError extends Error {
  clip?: VoiceCapturedClip;
  constructor(
    message: string,
    options?: { clip?: VoiceCapturedClip; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "VoiceSessionError";
    this.clip = options?.clip;
  }
}

function now() {
  return Date.now();
}

function updateState(
  state: VoiceSessionState,
  patch: Partial<VoiceSessionState>
): void {
  Object.assign(state, patch, { lastUpdated: now() });
}

function wrapError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "voice_session_error");
}

export function createVoiceSession(
  adapter: PlatformAdapter,
  client: VoiceClient,
  options: VoiceSessionOptions = {}
): VoiceSession {
  const state: VoiceSessionState = {
    capture: "idle",
    transcript: "",
    error: null,
    lastUpdated: now(),
  };

  const defaults = {
    voice: options.defaultVoice ?? DEFAULT_VOICE,
    format: options.defaultFormat ?? DEFAULT_FORMAT,
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
    if (!clip || !clip.audioBase64) {
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
      await adapter.configureSession?.({ background: false });
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
    overrides?: Partial<Pick<SttRequest, "language" | "model" | "prompt">>
  ): Promise<SttResult | null> => {
    ensureRecording();
    updateState(state, { capture: "processing", error: null });
    const clip = await finishCapture();
    if (!clip) {
      return null;
    }
    const payload: SttRequest = {
      audioBase64: clip.audioBase64,
      mimeType: clip.mimeType,
      language: overrides?.language,
      model: overrides?.model,
      prompt: overrides?.prompt,
    };
    try {
      const result = await client.sttTranscribe(payload);
      updateState(state, {
        capture: "complete",
        transcript: result?.text ?? "",
        error: null,
      });
      return result;
    } catch (error) {
      const wrapped = wrapError(error);
      updateState(state, { capture: "idle", error: wrapped.message });
      throw wrapped;
    }
  };

  const speak = async (input: TtsRequest): Promise<void> => {
    try {
      const payload: TtsRequest = {
        text: input.text,
        voice: input.voice ?? defaults.voice,
        format: input.format ?? defaults.format,
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
    overrides?: Partial<Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">>
  ): Promise<SpeechToSpeechResponse | null> => {
    if (!client.speechToSpeech) {
      throw new Error("speech_to_speech_unavailable");
    }
    ensureRecording();
    updateState(state, { capture: "processing", error: null });
    let clip: VoiceCapturedClip | null = null;
    try {
      const captured = await finishCapture();
      if (!captured) {
        return null;
      }
      clip = captured;
      const payload: SpeechToSpeechRequest = {
        audioBase64: captured.audioBase64,
        mimeType: captured.mimeType,
        language: overrides?.language,
        prompt: overrides?.prompt,
        thread: overrides?.thread,
        resource: overrides?.resource,
        sttModel: overrides?.sttModel,
        ttsModel: overrides?.ttsModel,
        ttsVoice: overrides?.ttsVoice ?? defaults.voice,
        ttsFormat: overrides?.ttsFormat ?? defaults.format,
      };
      const result = await client.speechToSpeech(payload);
      if (result?.transcript?.text) {
        updateState(state, {
          transcript: result.transcript.text,
          capture: "complete",
        });
      } else {
        updateState(state, { capture: "complete" });
      }
      if (result?.audio?.audioBase64) {
        await adapter.play(result.audio.audioBase64, result.audio.mimeType);
      }
      return result;
    } catch (error) {
      const wrapped = wrapError(error);
      updateState(state, { capture: "idle", error: wrapped.message });
      throw new VoiceSessionError(wrapped.message, {
        clip: clip ?? undefined,
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
