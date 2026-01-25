import { useEffect, useRef, useState } from "react";

export interface UseAudioRecorderOptions {
  active: boolean;
  fftSize?: number;
  smoothingTimeConstant?: number;
  enableAudioPlayback?: boolean;
  onError?: (error: Error) => void;
}

export function useAudioRecorder({
  active,
  fftSize = 2048,
  smoothingTimeConstant = 0.8,
  enableAudioPlayback = false,
  onError,
}: UseAudioRecorderOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let mounted = true;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        if (enableAudioPlayback) {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });
            setAudioBlob(blob);
          };

          mediaRecorder.start(100);
        }
      } catch (error) {
        if (mounted) {
          onError?.(error as Error);
        }
      }
    };

    const stopRecording = () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };

    if (active) {
      setAudioBlob(null); // Clear previous blob
      startRecording();
    } else {
      stopRecording();
    }

    return () => {
      mounted = false;
      stopRecording();
    };
  }, [active, fftSize, smoothingTimeConstant, enableAudioPlayback, onError]);

  return {
    analyserRef,
    audioBlob,
  };
}
