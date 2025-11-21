export type TtsFormat = "mp3" | "opus" | "wav";

export interface VoiceCapturedClip {
  audioBase64: string;
  mimeType: string;
}

export interface SttRequest {
  audioBase64: string;
  mimeType: string;
  model?: string;
  language?: string;
  prompt?: string;
}

export interface SttResult {
  text: string;
  language?: string | null;
  model?: string;
  durationSeconds?: number;
  provider?: string;
}

export interface TtsRequest {
  text: string;
  voice?: string;
  format?: TtsFormat;
  model?: string;
}

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  model?: string;
  provider?: string;
  durationSeconds?: number;
}

export interface SpeechToSpeechRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  thread?: string;
  resource?: string;
  sttModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
  ttsFormat?: TtsFormat;
}

export interface SpeechToSpeechResponse {
  transcript: {
    text: string;
    language?: string | null;
    model?: string;
    provider?: string;
  };
  assistant?: {
    text: string;
    replayId?: string;
    raw?: unknown;
  };
  audio: TtsResult;
  durations?: {
    totalSeconds?: number | null;
    sttSeconds?: number | null;
    assistantSeconds?: number | null;
    ttsSeconds?: number | null;
  };
}

export interface PlatformAdapter {
  configureSession?: (options?: { background?: boolean }) => Promise<void> | void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<{ audioBase64: string; mimeType: string } | null>;
  play: (audioBase64: string, mimeType: string) => Promise<void> | void;
}

export interface VoiceSessionOptions {
  defaultVoice?: string;
  defaultFormat?: TtsFormat;
}

export interface VoiceSessionState {
  capture: "idle" | "recording" | "processing" | "complete";
  transcript: string;
  error: string | null;
  lastUpdated: number;
}

export interface VoiceSessionMethods {
  start(): Promise<void>;
  stopAndTranscribe(
    overrides?: Partial<Pick<SttRequest, "language" | "model" | "prompt">>
  ): Promise<SttResult | null>;
  speak(opts: TtsRequest): Promise<void>;
  speechToSpeech?: (
    overrides?: Partial<Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">>
  ) => Promise<SpeechToSpeechResponse | null>;
  clear(): void;
}

export type VoiceSession = VoiceSessionMethods & {
  state: VoiceSessionState;
};

export interface VoiceClient {
  sttTranscribe(input: SttRequest): Promise<SttResult>;
  ttsSynthesize(input: TtsRequest): Promise<TtsResult>;
  speechToSpeech?: (
    input: SpeechToSpeechRequest
  ) => Promise<SpeechToSpeechResponse>;
}
