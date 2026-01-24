/**
 * CarPlay Voice Bridge
 *
 * Wraps ALFRED's existing useVoiceSessionNative hook for CarPlay context.
 * Provides a simplified API for CarPlay voice interactions.
 *
 * This is a BRIDGE - it does NOT reimplement voice functionality.
 * All voice processing uses existing infrastructure:
 * - STT: useVoiceSessionNative.stream (WebRTC/WebSocket)
 * - TTS: playBase64() from lib/voice/play.ts
 * - Intent: tRPC voice.speechToSpeech
 */

import type { VoiceSessionSurface } from "@alfred/voice/types";

import { useCallback, useEffect, useState } from "react";

import { useVoiceSessionNative } from "../../voice/session";
import { useCarPlayStore } from "../store";

export type CarPlayVoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type CarPlayVoiceBridgeConfig = {
  /** Base URL for voice streaming (optional) */
  baseUrl?: string | null;
  /** Cookie accessor for authenticated WebSocket */
  getCookie?: () => string | null;
  /** Callback when transcript updates */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Callback when assistant responds */
  onResponse?: (text: string) => void;
  /** Callback when status changes */
  onStatusChange?: (status: CarPlayVoiceStatus) => void;
  /** Callback on error */
  onError?: (error: string) => void;
};

export type CarPlayVoiceBridge = {
  /** Current voice status */
  status: CarPlayVoiceStatus;
  /** Current transcript (partial or final) */
  transcript: string;
  /** Last assistant response */
  response: string;
  /** Whether voice is currently active */
  isActive: boolean;
  /** Whether input is muted */
  isMuted: boolean;
  /** Whether streaming is supported */
  supported: boolean;
  /** Start listening for voice input */
  startListening: () => Promise<void>;
  /** Stop listening and process input */
  stopListening: () => Promise<void>;
  /** Speak text via TTS */
  speak: (text: string) => Promise<void>;
  /** Mute/unmute microphone */
  toggleMute: () => boolean;
  /** Access to underlying voice session */
  session: ReturnType<typeof useVoiceSessionNative>;
};

const CARPLAY_SURFACE: VoiceSessionSurface = "carplay";

/**
 * React hook for CarPlay voice integration.
 *
 * Use this in React components that need voice functionality.
 * The hook wraps useVoiceSessionNative with CarPlay-specific configuration.
 */
export function useCarPlayVoice(
  trpc: unknown,
  config?: CarPlayVoiceBridgeConfig
): CarPlayVoiceBridge {
  const [status, setStatus] = useState<CarPlayVoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  // Use the existing voice session hook
  const voiceSession = useVoiceSessionNative(trpc, {
    mode: "s2s",
    surface: CARPLAY_SURFACE,
    getCookie: config?.getCookie,
    baseUrl: config?.baseUrl,
  });

  // Map stream status to CarPlay status
  useEffect(() => {
    const streamStatus = voiceSession.stream.status;
    let newStatus: CarPlayVoiceStatus = "idle";

    switch (streamStatus) {
      case "connecting":
      case "recording":
        newStatus = "listening";
        break;
      case "processing":
        newStatus = "processing";
        break;
      case "playing":
        newStatus = "speaking";
        break;
      case "error":
        newStatus = "error";
        break;
      default:
        newStatus = "idle";
    }

    setStatus(newStatus);
    config?.onStatusChange?.(newStatus);
    useCarPlayStore.getState().setVoiceStatus(newStatus);
  }, [voiceSession.stream.status, config?.onStatusChange]);

  // Track transcript updates
  useEffect(() => {
    const text = voiceSession.stream.transcript;
    if (text !== transcript) {
      setTranscript(text);
      config?.onTranscript?.(text, voiceSession.stream.autoStopReason !== null);
    }
  }, [
    voiceSession.stream.transcript,
    voiceSession.stream.autoStopReason,
    transcript,
    config?.onTranscript,
  ]);

  // Track assistant responses
  useEffect(() => {
    const text = voiceSession.stream.assistantText;
    if (text && text !== response) {
      setResponse(text);
      config?.onResponse?.(text);
    }
  }, [voiceSession.stream.assistantText, response, config?.onResponse]);

  // Track errors
  useEffect(() => {
    const error = voiceSession.stream.error;
    if (error) {
      config?.onError?.(error);
    }
  }, [voiceSession.stream.error, config?.onError]);

  const startListening = useCallback(async () => {
    try {
      setTranscript("");
      setResponse("");
      if (voiceSession.stream.supported) {
        await voiceSession.stream.start();
      } else {
        await voiceSession.start();
      }
    } catch (error) {
      config?.onError?.(
        error instanceof Error ? error.message : "Failed to start"
      );
    }
  }, [voiceSession, config?.onError]);

  const stopListening = useCallback(async () => {
    try {
      if (voiceSession.stream.supported && voiceSession.stream.isActive) {
        await voiceSession.stream.stop();
      }
    } catch (error) {
      config?.onError?.(
        error instanceof Error ? error.message : "Failed to stop"
      );
    }
  }, [voiceSession, config?.onError]);

  const speak = useCallback(
    async (text: string) => {
      try {
        useCarPlayStore.getState().setTTSSpeaking(true);
        await voiceSession.speak({ text, voice: "alloy" });
        useCarPlayStore.getState().setTTSSpeaking(false);
      } catch (error) {
        useCarPlayStore.getState().setTTSSpeaking(false);
        config?.onError?.(
          error instanceof Error ? error.message : "Failed to speak"
        );
      }
    },
    [voiceSession, config?.onError]
  );

  const toggleMute = useCallback(() => {
    if (voiceSession.stream.supported) {
      return voiceSession.stream.toggleMute();
    }
    return false;
  }, [voiceSession]);

  return {
    status,
    transcript,
    response,
    isActive: voiceSession.stream.isActive,
    isMuted: voiceSession.stream.isMuted,
    supported: voiceSession.stream.supported,
    startListening,
    stopListening,
    speak,
    toggleMute,
    // Expose raw session for advanced use
    session: voiceSession,
  };
}
