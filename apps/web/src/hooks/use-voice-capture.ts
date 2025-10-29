/**
 * useVoiceCapture Hook
 * 
 * Composable hook for voice input/output
 * Handles STT/TTS streaming and audio playback
 * 
 * Carmack-Karpathy principles:
 * - Single responsibility: voice capture and playback
 * - Zero allocation in recording loop
 * - Fast failure on errors
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceCaptureOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
}

interface UseVoiceCaptureReturn {
  // State
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error: Error | null;
  
  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  playAudio: (audioData: string) => void;
  clearTranscript: () => void;
}

export function useVoiceCapture({
  onTranscript,
  onError,
}: UseVoiceCaptureOptions = {}): UseVoiceCaptureReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<Error | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // TODO: Send to tRPC voice.sttTranscribe
        setIsProcessing(true);
        // Simulate transcription
        setTimeout(() => {
          setTranscript("Transcribed text...");
          setIsProcessing(false);
          onTranscript?.("Transcribed text...");
        }, 1000);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording");
      setError(error);
      onError?.(error);
    }
  }, [onTranscript, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  // Play audio (TTS)
  const playAudio = useCallback((audioData: string) => {
    const audio = new Audio(audioData);
    audio.play().catch((err) => {
      const error = err instanceof Error ? err : new Error("Failed to play audio");
      setError(error);
      onError?.(error);
    });
  }, [onError]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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

