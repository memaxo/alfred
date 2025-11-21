import { arrayBufferToBase64, pcm16Base64ToFloat32 } from "@alfred/voice/audio";
import { createVoiceSession } from "@alfred/voice/session";
import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  VoiceClient,
  VoiceSessionDescriptor,
  VoiceSessionSurface,
} from "@alfred/voice/types";
import type { VoiceStreamCodec } from "@alfred/type/voice";
import type { VoiceStreamServerEvent } from "@alfred/type/voice";
import { VoiceStreamClient } from "@alfred/voice/stream";
import type { VoiceStreamClientHandlers } from "@alfred/voice/stream";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";
import { getVoiceStreamUrl } from "@/utils/voice-stream";

type SpeechOverrides = Partial<
  Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">
>;

export type UseVoiceSessionWebResult = {
  state: ReturnType<typeof createVoiceSession>["state"];
  isRecording: boolean;
  isProcessing: boolean;
  lastResponse: SpeechToSpeechResponse | null;
  error: string | null;
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
  speechToSpeech: (overrides?: SpeechOverrides) => Promise<void>;
  speak: ReturnType<typeof createVoiceSession>["speak"];
  clear: () => void;
  session: VoiceSessionDescriptor | null;
  refreshSession: () => Promise<VoiceSessionDescriptor | null>;
  stream: {
    supported: boolean;
    status: StreamStatus;
    transcript: string;
    assistantText: string;
    vadConfidence: number | null;
    autoStopReason: string | null;
    error: string | null;
    isActive: boolean;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    sessionId: string | null;
  };
};

type StreamStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "processing"
  | "playing"
  | "error";

type StreamState = {
  supported: boolean;
  status: StreamStatus;
  transcript: string;
  assistantText: string;
  vadConfidence: number | null;
  autoStopReason: string | null;
  error: string | null;
  sessionId: string | null;
};

const MAX_RECORDING_MS = 12_000;
const STREAM_SLICE_MS = 600;

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `voice-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const getMediaStream = createClientOnlyFn(async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("media_devices_unavailable");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
});

const createAudioElement = createClientOnlyFn((source: string) => {
  const audio = new Audio(source);
  audio.preload = "auto";
  return audio;
});

const getAudioContext = createClientOnlyFn(() => {
  if (typeof AudioContext === "undefined") {
    throw new Error("audio_context_unavailable");
  }
  return new AudioContext();
});

const clearTimeoutClient = createClientOnlyFn((id: number) =>
  window.clearTimeout(id)
);
const setTimeoutClient = createClientOnlyFn(
  (callback: () => void, ms: number) => window.setTimeout(callback, ms)
);

export function useVoiceSessionWeb(): UseVoiceSessionWebResult {
  const sttMutation = trpc.voice.sttTranscribe.useMutation();
  const ttsMutation = trpc.voice.ttsSynthesize.useMutation();
  const s2sMutation = trpc.voice.speechToSpeech.useMutation();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamClientRef = useRef<VoiceStreamClient | null>(null);
  const streamRecorderRef = useRef<MediaRecorder | null>(null);
  const streamMediaRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackCursorRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [lastResponse, setLastResponse] = useState<SpeechToSpeechResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceStateUpdate] = useState(0);
  const streamUrl = getVoiceStreamUrl();
  const [streamState, setStreamState] = useState<StreamState>({
    supported: Boolean(streamUrl),
    status: "idle",
    transcript: "",
    assistantText: "",
    vadConfidence: null,
    autoStopReason: null,
    error: null,
    sessionId: null,
  });
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionDescriptor | null>(null);
  const sessionSurface: VoiceSessionSurface = "web";
  const sessionIdRef = useRef<string>(createSessionId());
  const sessionSurface: VoiceSessionSurface = "web";
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionDescriptor | null>(null);

  const { data: prefs } = trpc.user.getPreferences.useQuery(undefined, {
    staleTime: 60000,
  });

  const syncSessionInfo = useCallback((snapshot: VoiceSessionDescriptor | null) => {
    if (snapshot?.id) {
      sessionIdRef.current = snapshot.id;
    }
    setSessionInfo(snapshot);
  }, []);

  const { data: sessionData, refetch: refetchSessions } = trpc.voice.sessions.useQuery(
    undefined,
    {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (sessionData && sessionData.length > 0) {
      syncSessionInfo(sessionData[0]);
    }
  }, [sessionData, syncSessionInfo]);

  const refreshSession = useCallback(async () => {
    const result = await refetchSessions();
    const snapshot = result.data && result.data.length > 0 ? result.data[0] : null;
    if (snapshot) {
      syncSessionInfo(snapshot);
    }
    return snapshot ?? null;
  }, [refetchSessions, syncSessionInfo]);

  const cleanupStream = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeoutClient(timeoutRef.current);
      timeoutRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  const stopStreamingRecorder = useCallback(async () => {
    const recorder = streamRecorderRef.current;
    const media = streamMediaRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            resolve();
          },
          { once: true }
        );
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }
    streamRecorderRef.current = null;
    if (media) {
      media.getTracks().forEach((track) => track.stop());
    }
    streamMediaRef.current = null;
  }, []);

  const ensureAudioPlaybackContext = useCallback(async () => {
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = getAudioContext();
      audioContextRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const finalizeRecording = useCallback(async () => {
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    if (!chunks.length) {
      return null;
    }
    const mimeType = chunks[0]?.type || "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });
    const arrayBuffer = await blob.arrayBuffer();
    return {
      mimeType,
      audioBase64: arrayBufferToBase64(arrayBuffer),
    };
  }, []);

  const adapter = useMemo(() => {
    return {
      configureSession: async () => {},
      startCapture: async () => {
        const stream = await getMediaStream();
        const Recorder = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
        if (!Recorder) {
          throw new Error("media_recorder_unavailable");
        }
        const recorder = new Recorder(stream);
        mediaRecorderRef.current = recorder;
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        recorder.onerror = (event) => {
          cleanupStream();
          const message = event.error?.message ?? "media_recorder_error";
          throw new Error(message);
        };
        recorder.start();
        timeoutRef.current = setTimeoutClient(() => {
          if (recorder.state !== "inactive") {
            try {
              recorder.stop();
            } catch {
              // ignore stop failure
            }
          }
        }, MAX_RECORDING_MS);
      },
      stopCapture: async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
          return null;
        }
        if (recorder.state === "inactive") {
          cleanupStream();
          return finalizeRecording();
        }

        return await new Promise<{ audioBase64: string; mimeType: string } | null>(
          (resolve, reject) => {
            const handleStop = async () => {
              try {
                const clip = await finalizeRecording();
                cleanupStream();
                resolve(clip);
              } catch (err) {
                reject(err instanceof Error ? err : new Error("recording_failed"));
              }
            };
            recorder.addEventListener("stop", handleStop, { once: true });
            try {
              recorder.stop();
            } catch (err) {
              recorder.removeEventListener("stop", handleStop);
              reject(err instanceof Error ? err : new Error("recording_failed"));
            }
          }
        );
      },
      play: async (audioBase64: string, mimeType: string) => {
        if (!audioBase64) return;
        const source = `data:${mimeType};base64,${audioBase64}`;
        const audio = createAudioElement(source);
        if (audioRef.current) {
          try {
            audioRef.current.pause();
          } catch {
            // ignore
          }
        }
        audioRef.current = audio;
        try {
          await audio.play();
        } catch (err) {
          throw err instanceof Error ? err : new Error("audio_playback_failed");
        }
      },
    };
  }, [cleanupStream, finalizeRecording]);

  const voiceClient = useMemo<VoiceClient>(() => {
    return {
      sttTranscribe: (input) => sttMutation.mutateAsync(input),
      ttsSynthesize: (input) => ttsMutation.mutateAsync(input),
      speechToSpeech: (input) => s2sMutation.mutateAsync(input),
    };
  }, [s2sMutation, sttMutation, ttsMutation]);

  const handleStreamTtsChunk = useCallback(
    async (chunk: Extract<VoiceStreamServerEvent, { type: "tts_chunk" }>) => {
      try {
        const ctx = await ensureAudioPlaybackContext();
        const floatData = pcm16Base64ToFloat32(chunk.audioBase64);
        const buffer = ctx.createBuffer(1, floatData.length, 16000);
        buffer.copyToChannel(floatData, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const startTime = Math.max(ctx.currentTime, playbackCursorRef.current);
        source.start(startTime);
        playbackCursorRef.current = startTime + buffer.duration;
        setStreamState((prev) => ({
          ...prev,
          status: "playing",
        }));
      } catch (err) {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error:
            err instanceof Error ? err.message : "voice_stream_playback_failed",
        }));
      }
    },
    [ensureAudioPlaybackContext]
  );

  const handleStreamAutoStop = useCallback(
    async (reason: "manual" | "silence" | "timeout") => {
      setStreamState((prev) => ({
        ...prev,
        autoStopReason: reason,
        status: "processing",
      }));
      await stopStreamingRecorder();
      setIsStreamingActive(false);
    },
    [stopStreamingRecorder]
  );

  const streamHandlers = useMemo<VoiceStreamClientHandlers>(
    () => ({
      onSessionStarted: (event) => {
        setStreamState((prev) => ({
          ...prev,
          status: "recording",
          sessionId: event.sessionId,
          transcript: "",
          assistantText: "",
          error: null,
          autoStopReason: null,
        }));
        sessionIdRef.current = event.sessionId;
      },
      onPartialTranscript: (event) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onFinalTranscript: (event) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onVadState: (event) => {
        setStreamState((prev) => ({
          ...prev,
          vadConfidence: event.vadConfidence ?? null,
        }));
      },
      onAutoStop: (event) => {
        void handleStreamAutoStop(event.reason);
      },
      onAssistantMessage: (event) => {
        setStreamState((prev) => ({
          ...prev,
          assistantText: event.text,
        }));
      },
      onTtsChunk: handleStreamTtsChunk,
      onTtsComplete: () => {
        setStreamState((prev) => ({
          ...prev,
          status: "idle",
        }));
      },
      onStatus: (event) => {
        setStreamState((prev) => ({
          ...prev,
          status: event.state,
        }));
      },
      onError: (event) => {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error: event.message,
        }));
        setIsStreamingActive(false);
      },
    }),
    [handleStreamAutoStop, handleStreamTtsChunk]
  );

  const getStreamClient = useCallback(() => {
    if (!streamUrl) {
      throw new Error("voice_stream_url_missing");
    }
    if (streamClientRef.current) {
      return streamClientRef.current;
    }
    const client = new VoiceStreamClient(
      {
        url: streamUrl,
      },
      streamHandlers
    );
    streamClientRef.current = client;
    return client;
  }, [streamHandlers, streamUrl]);

  const startStreamingRecorder = useCallback(
    async (client: VoiceStreamClient) => {
      const stream = await getMediaStream();
      const Recorder = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
      if (!Recorder) {
        throw new Error("media_recorder_unavailable");
      }
      await ensureAudioPlaybackContext().catch(() => undefined);
      const recorder = new Recorder(stream);
      streamRecorderRef.current = recorder;
      streamMediaRef.current = stream;
      setIsStreamingActive(true);
      recorder.start(STREAM_SLICE_MS);
      recorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          try {
            const buffer = await event.data.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            await client.sendAudioChunk({
              audioBase64: base64,
              mimeType: event.data.type || "audio/webm",
            });
          } catch (err) {
            setStreamState((prev) => ({
              ...prev,
              status: "error",
              error:
                err instanceof Error
                  ? err.message
                  : "voice_stream_chunk_failed",
            }));
          }
        }
      };
      recorder.onerror = (event) => {
        const message = event.error?.message ?? "media_recorder_error";
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      };
      setStreamState((prev) => ({
        ...prev,
        status: "recording",
      }));
    },
    [ensureAudioPlaybackContext]
  );

  const preferredStreamCodec = useMemo<VoiceStreamCodec>(() => {
    const sessionCodec = sessionInfo?.codec?.output;
    const prefsCodec = prefs?.find((p: any) => p.key === "voice.codec")?.value as string;
    const codec = prefsCodec || sessionCodec;
    
    if (codec === "mp3" || codec === "opus" || codec === "wav" || codec === "pcm") {
      return codec;
    }
    return "mp3";
  }, [sessionInfo, prefs]);

  const startStreaming = useCallback(async () => {
    if (!streamUrl) {
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
      const client = getStreamClient();
      await client.startSession({
        sessionId: sessionIdRef.current,
        surface: sessionSurface,
        codec: preferredStreamCodec,
      });
      await startStreamingRecorder(client);
    } catch (err) {
      setStreamState((prev) => ({
        ...prev,
        status: "error",
        error:
          err instanceof Error ? err.message : "voice_stream_start_failed",
      }));
      setIsStreamingActive(false);
      throw err;
    }
  }, [getStreamClient, preferredStreamCodec, sessionSurface, startStreamingRecorder, streamUrl]);

  const stopStreaming = useCallback(async () => {
    await stopStreamingRecorder();
    setIsStreamingActive(false);
    try {
      await streamClientRef.current?.stop("manual");
    } catch (err) {
      setStreamState((prev) => ({
        ...prev,
        error:
          err instanceof Error ? err.message : "voice_stream_stop_failed",
      }));
    }
  }, [stopStreamingRecorder]);

  const session = useMemo(
    () => createVoiceSession(adapter, voiceClient),
    [adapter, voiceClient]
  );

  const syncState = useCallback(() => {
    forceStateUpdate((value) => value + 1);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setLastResponse(null);
    await session.start();
    setIsRecording(true);
    syncState();
  }, [session, syncState]);

  const stopAndTranscribe = useCallback(async () => {
    if (!isRecording) return;
    setIsProcessing(true);
    try {
      await session.stopAndTranscribe();
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "voice_transcription_failed";
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
      setIsRecording(false);
      syncState();
    }
  }, [isRecording, session, syncState]);

  const speechToSpeech = useCallback(
    async (overrides?: SpeechOverrides) => {
      if (!session.speechToSpeech) {
        throw new Error("speech_to_speech_unavailable");
      }
      setIsProcessing(true);
      try {
        const result = await session.speechToSpeech({
          ...overrides,
          sessionId: sessionIdRef.current,
          surface: sessionSurface,
        });
        if (result?.session) {
          syncSessionInfo(result.session);
        }
        setLastResponse(result ?? null);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "speech_to_speech_failed";
        setError(message);
        throw err;
      } finally {
        setIsProcessing(false);
        setIsRecording(false);
        syncState();
      }
    },
    [session, sessionSurface, syncSessionInfo, syncState]
  );

  const speak = useCallback(
    async (input: Parameters<typeof session.speak>[0]) => {
      try {
        await session.speak(input);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "voice_speak_failed";
        setError(message);
        throw err;
      } finally {
        syncState();
      }
    },
    [session, syncState]
  );

  const clear = useCallback(() => {
    session.clear();
    setLastResponse(null);
    setError(null);
    syncState();
  }, [session, syncState]);

  useEffect(() => {
    setStreamState((prev) => ({
      ...prev,
      supported: Boolean(streamUrl),
    }));
  }, [streamUrl]);

  useEffect(() => {
    return () => {
      cleanupStream();
      stopStreamingRecorder().catch(() => undefined);
      const client = streamClientRef.current;
      if (client) {
        void client.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // ignore
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [cleanupStream, stopStreamingRecorder]);

  const busy =
    isProcessing ||
    sttMutation.isPending ||
    ttsMutation.isPending ||
    s2sMutation.isPending;

  const streamApi = {
    supported: streamState.supported,
    status: streamState.status,
    transcript: streamState.transcript,
    assistantText: streamState.assistantText,
    vadConfidence: streamState.vadConfidence,
    autoStopReason: streamState.autoStopReason,
    error: streamState.error,
    isActive: isStreamingActive,
    sessionId: streamState.sessionId,
    start: streamState.supported ? startStreaming : async () => {
      throw new Error("voice_streaming_unavailable");
    },
    stop: streamState.supported ? stopStreaming : async () => {},
  };

  return {
    state: session.state,
    isRecording,
    isProcessing: busy,
    lastResponse,
    error,
    start,
    stopAndTranscribe,
    speechToSpeech,
    speak,
    clear,
    stream: streamApi,
    session: sessionInfo,
     refreshSession,
  };
}
