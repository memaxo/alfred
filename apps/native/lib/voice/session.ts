import { markVoice } from "@alfred/metrics/performance";
import type { VoiceStreamCodec } from "@alfred/type/voice";
import type { PlatformAdapter } from "@alfred/voice";
import { wrapPCM16AsWavBase64 } from "@alfred/voice/audio";
import { createVoiceSession, VoiceSessionError } from "@alfred/voice/session";
import { VoiceStreamClient } from "@alfred/voice/stream";
import { createVoiceClient } from "@alfred/voice/transport";
import type {
  SpeechToSpeechRequest,
  SttRequest,
  TtsRequest,
  VoiceSessionDescriptor,
  VoiceSessionSurface,
} from "@alfred/voice/types";
import { Audio } from "expo-av";
import { deleteAsync, EncodingType, readAsStringAsync } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpoCapture } from "./capture";
import { configureAudioSession } from "./config";
import { getVoiceStreamUrl } from "./env";
import { playBase64 } from "./play";
import { enqueue } from "./queue";
import type { VoiceS2SPayload } from "./voice.types";

type MutationAdapter = {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
};

type MutationInvoker = (path: string, input: unknown) => Promise<unknown>;

function hasMutationInvoker(
  value: unknown
): value is { mutation: MutationInvoker } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { mutation?: unknown }).mutation === "function"
  );
}

function hasMutate(
  value: unknown
): value is { mutate: (input: unknown) => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { mutate?: unknown }).mutate === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveMutation(
  rawClient: unknown,
  path: string,
  input: unknown
): Promise<unknown> {
  if (hasMutationInvoker(rawClient)) {
    return rawClient.mutation(path, input);
  }

  const segments = path.split(".");
  let cursor: unknown = rawClient;

  for (const segment of segments) {
    if (isRecord(cursor) && segment in cursor) {
      cursor = cursor[segment];
    } else {
      cursor = null;
      break;
    }
  }

  if (hasMutate(cursor)) {
    return cursor.mutate(input);
  }

  throw new Error(`tRPC client missing mutation handler for ${path}`);
}

function hasQuery(
  value: unknown
): value is { query: (input: unknown) => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { query?: unknown }).query === "function"
  );
}

function resolveQuery(
  rawClient: unknown,
  path: string,
  input?: unknown
): Promise<unknown> {
  const segments = path.split(".");
  let cursor: unknown = rawClient;

  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      cursor = null;
      break;
    }
  }

  if (hasQuery(cursor)) {
    return cursor.query(input);
  }
  throw new Error(`tRPC client missing query handler for ${path}`);
}

function toMutationAdapter(trpc: unknown): MutationAdapter {
  return {
    mutation: <TInput, TOutput>(path: string, input: TInput) =>
      resolveMutation(trpc, path, input) as Promise<TOutput>,
  };
}

type VoiceSessionNativeOptions = {
  mode?: "classic" | "s2s";
  surface?: VoiceSessionSurface;
  speechDefaults?: Partial<
    Pick<
      SpeechToSpeechRequest,
      "thread" | "resource" | "ttsVoice" | "ttsFormat" | "language" | "prompt"
    >
  >;
};

type StreamStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "processing"
  | "playing"
  | "error";

type NativeStreamState = {
  supported: boolean;
  status: StreamStatus;
  transcript: string;
  assistantText: string;
  vadConfidence: number | null;
  autoStopReason: string | null;
  error: string | null;
  sessionId: string | null;
};

const STREAM_CHUNK_MS = 1200;
const STREAM_TIMEOUT_MS = 20_000;
const STREAM_CAPTURE_MIME = "audio/m4a";

function generateVoiceSessionId() {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `voice-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function useVoiceSessionNative(
  trpc: unknown,
  options?: VoiceSessionNativeOptions
) {
  const captureRef = useMemo(() => ({ current: new ExpoCapture() }), []);
  const mutationAdapter = useMemo(() => toMutationAdapter(trpc), [trpc]);
  const client = useMemo(
    () => createVoiceClient({ trpc: mutationAdapter }),
    [mutationAdapter]
  );
  const preferredMode = options?.mode ?? "s2s";
  const sessionSurface: VoiceSessionSurface = options?.surface ?? "drive";
  const preferSpeechToSpeech = preferredMode !== "classic";
  const speechDefaults = useMemo(
    () => ({
      thread: options?.speechDefaults?.thread,
      resource: options?.speechDefaults?.resource,
      ttsVoice: options?.speechDefaults?.ttsVoice ?? "alloy",
      ttsFormat: options?.speechDefaults?.ttsFormat ?? "mp3",
      language: options?.speechDefaults?.language,
      prompt: options?.speechDefaults?.prompt,
    }),
    [options]
  );
  const preferredStreamCodec = useMemo<VoiceStreamCodec>(() => {
    const format = options?.speechDefaults?.ttsFormat ?? "mp3";
    if (format === "opus" || format === "wav") {
      return format;
    }
    return "mp3";
  }, [options]);

  const adapter: PlatformAdapter = useMemo(
    () => ({
      configureSession: (options?: { background?: boolean }) =>
        configureAudioSession(Audio, { background: options?.background }),
      startCapture: () => captureRef.current.start(),
      stopCapture: () => captureRef.current.stop(),
      play: (base64: string, mimeType: string) => playBase64(base64, mimeType),
    }),
    [captureRef]
  );

  const session = useMemo(
    () => createVoiceSession(adapter, client),
    [adapter, client]
  );

  const streamUrlRef = useRef(getVoiceStreamUrl());
  const [streamState, setStreamState] = useState<NativeStreamState>({
    supported: Boolean(streamUrlRef.current),
    status: "idle",
    transcript: "",
    assistantText: "",
    vadConfidence: null,
    autoStopReason: null,
    error: null,
    sessionId: null,
  });
  const sessionIdRef = useRef<string>(generateVoiceSessionId());
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionDescriptor | null>(
    null
  );

  const streamClientRef = useRef<VoiceStreamClient | null>(null);
  const streamingActiveRef = useRef(false);
  const streamingStopRef = useRef(false);
  const streamingMutedRef = useRef(false);
  const currentRecordingRef = useRef<Audio.Recording | null>(null);
  const playbackQueueRef = useRef<string[]>([]);
  const playbackRunningRef = useRef(false);
  const syncSessionInfo = useCallback(
    (snapshot: VoiceSessionDescriptor | null) => {
      if (snapshot?.id) {
        sessionIdRef.current = snapshot.id;
      }
      setSessionInfo(snapshot);
    },
    []
  );

  const refreshSessionInfo = useCallback(async () => {
    try {
      const sessions = (await resolveQuery(
        trpc,
        "voice.sessions",
        undefined
      )) as VoiceSessionDescriptor[] | undefined | null;
      const snapshot = sessions && sessions.length > 0 ? sessions[0] : null;
      if (snapshot) {
        syncSessionInfo(snapshot);
      }
      return snapshot;
    } catch (_error) {
      return null;
    }
  }, [syncSessionInfo, trpc]);

  const start = useCallback(async () => {
    markVoice("fast_capture_start");
    await session.start();
  }, [session]);

  const stopAndTranscribe = useCallback(
    async (opts?: Partial<SttRequest>) => {
      try {
        const result = await session.stopAndTranscribe(opts);
        markVoice("fast_stream_flush");
        return result;
      } catch (error) {
        const clip = await captureRef.current.stop();
        if (clip) {
          await enqueue({
            kind: "stt",
            payload: {
              audioBase64: clip.audioBase64,
              mimeType: clip.mimeType,
              language: opts?.language,
              prompt: opts?.prompt,
            },
          });
        }
        throw error;
      }
    },
    [captureRef, session]
  );

  const speak = useCallback(
    async (opts: TtsRequest) => {
      try {
        await session.speak(opts);
      } catch (error) {
        await enqueue({
          kind: "tts",
          payload: {
            text: opts.text,
            voice: opts.voice,
          },
        });
        throw error;
      }
    },
    [session]
  );

  const speechToSpeechCallback = useCallback(
    async (
      overrides?: Partial<
        Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">
      >
    ) => {
      const payloadOverrides = {
        thread: overrides?.thread ?? speechDefaults.thread,
        resource: overrides?.resource ?? speechDefaults.resource,
        ttsVoice: overrides?.ttsVoice ?? speechDefaults.ttsVoice,
        ttsFormat: overrides?.ttsFormat ?? speechDefaults.ttsFormat,
        language: overrides?.language ?? speechDefaults.language,
        prompt: overrides?.prompt ?? speechDefaults.prompt,
        sttModel: overrides?.sttModel,
        ttsModel: overrides?.ttsModel,
        sessionId: sessionIdRef.current,
        surface: sessionSurface,
      };
      try {
        const result = await session.speechToSpeech?.(payloadOverrides);
        if (result?.session) {
          syncSessionInfo(result.session);
        }
        markVoice("fast_stream_flush");
        return result ?? null;
      } catch (error) {
        if (error instanceof VoiceSessionError && error.clip) {
          const queuedPayload: VoiceS2SPayload = {
            audioBase64: error.clip.audioBase64,
            mimeType: error.clip.mimeType,
            language: payloadOverrides.language,
            prompt: payloadOverrides.prompt,
            thread: payloadOverrides.thread,
            resource: payloadOverrides.resource,
            ttsVoice: payloadOverrides.ttsVoice,
            ttsFormat: payloadOverrides.ttsFormat,
            sessionId: sessionIdRef.current,
            surface: sessionSurface,
          };
          await enqueue({
            kind: "s2s",
            payload: queuedPayload,
          });
        }
        throw error;
      }
    },
    [session, sessionSurface, speechDefaults, syncSessionInfo]
  );

  const speechToSpeech =
    preferSpeechToSpeech && session.speechToSpeech
      ? speechToSpeechCallback
      : undefined;

  useEffect(() => {
    streamUrlRef.current = getVoiceStreamUrl();
    setStreamState((prev) => ({
      ...prev,
      supported: Boolean(streamUrlRef.current),
    }));
  }, []);

  useEffect(() => {
    refreshSessionInfo().catch(() => {
      // ignore
    });
  }, [refreshSessionInfo]);

  const enqueuePlayback = useCallback(async (pcmBase64: string) => {
    const wavBase64 = wrapPCM16AsWavBase64(pcmBase64);
    playbackQueueRef.current.push(wavBase64);
    if (playbackRunningRef.current) {
      return;
    }
    playbackRunningRef.current = true;
    try {
      while (playbackQueueRef.current.length > 0) {
        const clip = playbackQueueRef.current.shift();
        if (clip) {
          await playBase64(clip, "audio/wav");
        }
      }
    } finally {
      playbackRunningRef.current = false;
    }
  }, []);

  const stopStreamingCapture = useCallback(async () => {
    streamingStopRef.current = true;
    streamingActiveRef.current = false;
    const recording = currentRecordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // ignore stop errors
      }
    }
    currentRecordingRef.current = null;
  }, []);

  const streamHandlers = useMemo(
    () => ({
      onSessionStarted: (event: { sessionId: string }) => {
        setStreamState((prev) => ({
          ...prev,
          status: "recording",
          sessionId: event.sessionId,
          error: null,
          transcript: "",
          assistantText: "",
          autoStopReason: null,
        }));
        sessionIdRef.current = event.sessionId;
      },
      onPartialTranscript: (event: { text: string }) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onFinalTranscript: (event: { text: string }) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onVadState: (event: { vadConfidence: number | null }) => {
        setStreamState((prev) => ({
          ...prev,
          vadConfidence: event.vadConfidence ?? null,
        }));
      },
      onAutoStop: (event: { reason: "manual" | "silence" | "timeout" }) => {
        setStreamState((prev) => ({
          ...prev,
          autoStopReason: event.reason,
          status: "processing",
        }));
        void stopStreamingCapture();
      },
      onAssistantMessage: (event: { text: string }) => {
        setStreamState((prev) => ({
          ...prev,
          assistantText: event.text,
        }));
      },
      onTtsChunk: (event: { audioBase64: string }) => {
        void enqueuePlayback(event.audioBase64);
      },
      onTtsComplete: () => {
        setStreamState((prev) => ({
          ...prev,
          status: "idle",
        }));
      },
      onInterrupt: () => {
        // Clear any queued playback
        playbackQueueRef.current = [];
        // If we have an active audio object (how Expo handles it?),
        // playBase64 doesn't return a handle to stop.
        // It's fire-and-forget in the current implementation.
        // We would need to refactor playBase64 to return sound object to stop it.
        // For now, we just clear the queue.
        setStreamState((prev) => ({
          ...prev,
          status: "recording", // Resume listening state
        }));
      },
      onStatus: (event: { state: StreamStatus }) => {
        setStreamState((prev) => ({
          ...prev,
          status: event.state,
        }));
      },
      onError: (event: { message: string }) => {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error: event.message,
        }));
        streamingActiveRef.current = false;
      },
    }),
    [enqueuePlayback, stopStreamingCapture]
  );

  const ensureStreamClient = useCallback(() => {
    const url = streamUrlRef.current;
    if (!url) {
      throw new Error("voice_streaming_unavailable");
    }
    if (streamClientRef.current) {
      return streamClientRef.current;
    }
    const client = new VoiceStreamClient({ url }, streamHandlers);
    streamClientRef.current = client;
    return client;
  }, [streamHandlers]);

  const recordChunk = useCallback(async (durationMs: number) => {
    const recording = new Audio.Recording();
    currentRecordingRef.current = recording;
    const options =
      Audio.RecordingOptionsPresets?.HIGH_QUALITY ??
      (
        Audio as unknown as {
          RecordingOptionsPresets?: { HIGH_QUALITY?: unknown };
        }
      ).RecordingOptionsPresets?.HIGH_QUALITY;
    await recording.prepareToRecordAsync(options);
    await recording.startAsync();
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
    currentRecordingRef.current = null;
    const uri = recording.getURI();
    if (!uri) {
      return null;
    }
    try {
      const audioBase64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      await deleteAsync(uri, { idempotent: true });
      return { audioBase64, mimeType: STREAM_CAPTURE_MIME };
    } catch (error) {
      await deleteAsync(uri, { idempotent: true }).catch(() => {
        // ignore
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }, []);

  const runStreamCapture = useCallback(
    async (client: VoiceStreamClient) => {
      streamingActiveRef.current = true;
      streamingStopRef.current = false;
      const startTime = Date.now();
      try {
        await configureAudioSession(Audio, { background: true });
        while (!streamingStopRef.current) {
          if (Date.now() - startTime > STREAM_TIMEOUT_MS) {
            setStreamState((prev) => ({
              ...prev,
              autoStopReason: "timeout",
            }));
            break;
          }
          const clip = await recordChunk(STREAM_CHUNK_MS);
          if (!clip || streamingStopRef.current) {
            continue;
          }
          // Skip sending audio if muted
          if (streamingMutedRef.current) {
            continue;
          }
          // Convert base64 to binary for transport
          const binary = Uint8Array.from(atob(clip.audioBase64), (c) =>
            c.charCodeAt(0)
          );
          await client.sendAudioChunk({
            audio: binary,
            mimeType: clip.mimeType,
          });
        }
      } catch (error) {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "voice_stream_capture_failed",
        }));
      } finally {
        streamingActiveRef.current = false;
        currentRecordingRef.current = null;
      }
    },
    [recordChunk]
  );

  const startStreaming = useCallback(async () => {
    if (!streamUrlRef.current) {
      throw new Error("voice_streaming_unavailable");
    }
    setStreamState((prev) => ({
      ...prev,
      status: "connecting",
      transcript: "",
      assistantText: "",
      autoStopReason: null,
      error: null,
    }));
    try {
      const client = ensureStreamClient();
      await client.startSession({
        sessionId: sessionIdRef.current,
        surface: sessionSurface,
        codec: preferredStreamCodec,
      });
      void runStreamCapture(client);
    } catch (error) {
      setStreamState((prev) => ({
        ...prev,
        status: "error",
        error:
          error instanceof Error ? error.message : "voice_stream_start_failed",
      }));
      throw error;
    }
  }, [
    ensureStreamClient,
    preferredStreamCodec,
    runStreamCapture,
    sessionSurface,
  ]);

  const stopStreaming = useCallback(async () => {
    setStreamState((prev) => ({
      ...prev,
      status: "processing",
      autoStopReason: "manual",
    }));
    await stopStreamingCapture();
    try {
      await streamClientRef.current?.stop("manual");
    } catch (error) {
      setStreamState((prev) => ({
        ...prev,
        status: "error",
        error:
          error instanceof Error ? error.message : "voice_stream_stop_failed",
      }));
    }
  }, [stopStreamingCapture]);

  useEffect(
    () => () => {
      void stopStreamingCapture();
      const client = streamClientRef.current;
      if (client) {
        void client.close();
      }
    },
    [stopStreamingCapture]
  );

  const startFallback = () => {
    throw new Error("voice_streaming_unavailable");
  };

  const stopFallback = async () => {
    // ignore
  };

  const streamApi = {
    supported: streamState.supported,
    status: streamState.status,
    transcript: streamState.transcript,
    assistantText: streamState.assistantText,
    vadConfidence: streamState.vadConfidence,
    autoStopReason: streamState.autoStopReason,
    error: streamState.error,
    sessionId: streamState.sessionId,
    start: streamState.supported ? startStreaming : startFallback,
    stop: streamState.supported ? stopStreaming : stopFallback,
    isActive: streamState.status === "recording",
    mute: () => {
      streamingMutedRef.current = true;
    },
    unmute: () => {
      streamingMutedRef.current = false;
    },
    toggleMute: () => {
      streamingMutedRef.current = !streamingMutedRef.current;
      return streamingMutedRef.current;
    },
    get isMuted() {
      return streamingMutedRef.current;
    },
  };

  return {
    state: session.state,
    start,
    stopAndTranscribe,
    speak,
    speechToSpeech,
    clear: session.clear,
    stream: streamApi,
    session: sessionInfo,
    syncSession: syncSessionInfo,
    refreshSession: refreshSessionInfo,
  };
}
