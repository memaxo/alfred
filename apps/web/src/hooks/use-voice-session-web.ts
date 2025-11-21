import { arrayBufferToBase64 } from "@alfred/voice/audio";
import { createVoiceSession } from "@alfred/voice/session";
import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  VoiceClient,
} from "@alfred/voice/types";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

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
};

const MAX_RECORDING_MS = 12_000;

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

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<SpeechToSpeechResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceStateUpdate] = useState(0);

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
        const result = await session.speechToSpeech(overrides);
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
    [session, syncState]
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
    return () => {
      cleanupStream();
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
  }, [cleanupStream]);

  const busy =
    isProcessing ||
    sttMutation.isPending ||
    ttsMutation.isPending ||
    s2sMutation.isPending;

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
  };
}
