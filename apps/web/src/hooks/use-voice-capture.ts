import { arrayBufferToBase64 } from "@alfred/voice/audio";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

type UseVoiceCaptureOptions = {
  deviceId?: string;
  onTranscript?: (text: string) => Promise<void> | void;
  onError?: (error: Error) => void;
};

type UseVoiceCaptureReturn = {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error: Error | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playAudio: (audioBase64: string, mimeType: string) => void;
  clearTranscript: () => void;
};

const MAX_RECORDING_MS = 10_000; // keep clips short for MVP

const clearTimeoutClient = createClientOnlyFn((id: number) => {
  window.clearTimeout(id);
});

const setTimeoutClient = createClientOnlyFn(
  (callback: () => void, delay: number) => window.setTimeout(callback, delay)
);

const getUserMediaClient = createClientOnlyFn(async (deviceId?: string) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("media_devices_unavailable");
  }

  const audio: MediaTrackConstraints | boolean = deviceId
    ? { deviceId: { exact: deviceId } }
    : true;
  return await navigator.mediaDevices.getUserMedia({ audio });
});

export function useVoiceCapture({
  deviceId,
  onTranscript,
  onError,
}: UseVoiceCaptureOptions = {}): UseVoiceCaptureReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [manualProcessing, setManualProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Assume this can now handle raw Buffer/ArrayBuffer if we updated VoiceStreamClient.
  // For now, if we want to stream raw audio, we need access to the stream client instance.
  // But sttMutation is a tRPC procedure, not the stream client.
  // The stream client is usually accessed via `useVoiceSession` or similar hook that uses `VoiceStreamClient`.
  // Wait, `useVoiceCapture` seems to be using `sttTranscribe` mutation (HTTP POST), not streaming.
  // The streaming hook is likely `useVoiceSessionWeb` or similar.

  // Let's check `apps/web/src/hooks/use-voice-session-web.ts` which was in the file list.
  const sttMutation = trpc.voice.sttTranscribe.useMutation();

  const isProcessing = useMemo(
    () => manualProcessing || sttMutation.isPending,
    [manualProcessing, sttMutation.isPending]
  );

  const cleanupStream = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore stop race
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    if (timeoutRef.current) {
      clearTimeoutClient(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      const wrappedError =
        err instanceof Error ? err : new Error("voice_capture_failure");
      setError(wrappedError);
      onError?.(wrappedError);
    },
    [onError]
  );

  const processRecording = useCallback(async () => {
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    if (chunks.length === 0) {
      return;
    }
    const mimeType = chunks[0]?.type ?? "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });

    setManualProcessing(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const result = await sttMutation.mutateAsync({
        audioBase64: base64,
        mimeType,
      });
      const text = (result?.text ?? "").trim();
      if (text.length === 0) {
        throw new Error("transcription_empty");
      }
      setTranscript(text);
      setError(null);
      await onTranscript?.(text);
    } catch (err) {
      handleError(err);
    } finally {
      setManualProcessing(false);
    }
  }, [handleError, onTranscript, sttMutation]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) {
      return;
    }
    if (mediaRecorderRef.current.state === "inactive") {
      return;
    }
    try {
      mediaRecorderRef.current.stop();
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) {
      return;
    }
    try {
      const stream = await getUserMediaClient(deviceId);
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        cleanupStream();
        handleError(event.error ?? new Error("media_recorder_error"));
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        await processRecording();
        cleanupStream();
      };
      recorder.start();
      setTranscript("");
      setError(null);
      setIsRecording(true);
      const timeoutId = setTimeoutClient(() => {
        stopRecording();
      }, MAX_RECORDING_MS);
      timeoutRef.current = timeoutId;
    } catch (err) {
      cleanupStream();
      if (err instanceof Error && err.message === "media_devices_unavailable") {
        handleError(err);
      } else {
        handleError(new Error("voice_unavailable_on_server"));
      }
    }
  }, [
    cleanupStream,
    deviceId,
    handleError,
    isProcessing,
    isRecording,
    processRecording,
    stopRecording,
  ]);

  const playAudio = useCallback(
    (audioBase64: string, mimeType: string) => {
      if (!audioBase64) {
        return;
      }
      const source = `data:${mimeType};base64,${audioBase64}`;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      const audio = new Audio(source);
      audioRef.current = audio;
      audio.play().catch((err) => {
        handleError(err);
      });
    },
    [handleError]
  );

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // ignore pause failure
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [cleanupStream]);

  return {
    isRecording,
    isProcessing,
    transcript,
    error,
    startRecording,
    stopRecording,
    playAudio,
    clearTranscript,
  };
}
