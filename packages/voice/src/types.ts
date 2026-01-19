export type TtsFormat = "mp3" | "opus" | "wav";
export type VoiceSessionSurface =
  | "drive"
  | "carplay"
  | "web"
  | "native"
  | "stream"
  | "unknown";
export type VoiceSessionStatus =
  | "idle"
  | "recording"
  | "processing"
  | "responding"
  | "error";

export type VoiceSessionDescriptor = {
  id: string;
  surface: VoiceSessionSurface;
  mode: "clip" | "stream";
  status: VoiceSessionStatus;
  createdAt: number;
  updatedAt: number;
  thread?: string;
  resource?: string;
  codec?: {
    input?: string;
    output?: string;
  };
  lastTranscript?: string;
  lastAssistantText?: string;
  lastError?: string;
};

export type VoiceCapturedClip = {
  audioBase64: string;
  mimeType: string;
};

export type SttRequest = {
  audioBase64: string;
  mimeType: string;
  model?: string;
  language?: string;
  prompt?: string;
};

export type SttChunkSize = "fast" | "low" | "medium" | "accurate";

export type SttStreamingRequest = SttRequest & {
  sessionId: string;
  chunkSize?: SttChunkSize;
  clearCache?: boolean;
};

export type SttResult = {
  text: string;
  language?: string | null;
  model?: string;
  durationSeconds?: number;
  provider?: string;
};

export type SttStreamingResult = SttResult & {
  isPartial?: boolean;
  streamingEnabled?: boolean;
};

export type TtsRequest = {
  text: string;
  voice?: string;
  format?: TtsFormat;
  model?: string;
};

export type TtsResult = {
  audioBase64: string;
  mimeType: string;
  model?: string;
  provider?: string;
  durationSeconds?: number;
};

export type SpeechToSpeechRequest = {
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
  sessionId?: string;
  surface?: VoiceSessionSurface;
  inputCodec?: string;
  outputCodec?: string;
};

export type SpeechToSpeechResponse = {
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
  session?: VoiceSessionDescriptor;
};

export type PlatformAdapter = {
  configureSession?: (options?: {
    background?: boolean;
  }) => Promise<void> | void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<{ audioBase64: string; mimeType: string } | null>;
  play: (audioBase64: string, mimeType: string) => Promise<void> | void;
};

export type VoiceSessionOptions = {
  defaultVoice?: string;
  defaultFormat?: TtsFormat;
};

export type VoiceSessionState = {
  capture: "idle" | "recording" | "processing" | "complete";
  transcript: string;
  error: string | null;
  lastUpdated: number;
};

export type VoiceSessionMethods = {
  start(): Promise<void>;
  stopAndTranscribe(
    overrides?: Partial<Pick<SttRequest, "language" | "model" | "prompt">>
  ): Promise<SttResult | null>;
  speak(opts: TtsRequest): Promise<void>;
  speechToSpeech?: (
    overrides?: Partial<Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">>
  ) => Promise<SpeechToSpeechResponse | null>;
  clear(): void;
};

export type VoiceSession = VoiceSessionMethods & {
  state: VoiceSessionState;
};

export type VoiceClient = {
  sttTranscribe(input: SttRequest): Promise<SttResult>;
  sttTranscribeStreaming?: (
    input: SttStreamingRequest
  ) => Promise<SttStreamingResult>;
  sttClearCache?: (input: { sessionId: string }) => Promise<{
    cleared: boolean;
    sessionId: string;
  }>;
  sttReleaseSession?: (input: { sessionId: string }) => Promise<{
    released: boolean;
    sessionId: string;
  }>;
  sttSessionInfo?: (input: { sessionId: string }) => Promise<{
    sessionId: string;
    hasAffinity: boolean;
    processIndex?: number;
  }>;
  ttsSynthesize(input: TtsRequest): Promise<TtsResult>;
  speechToSpeech?: (
    input: SpeechToSpeechRequest
  ) => Promise<SpeechToSpeechResponse>;
};
