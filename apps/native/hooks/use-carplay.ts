/**
 * useCarPlay Hook
 *
 * React hook for integrating CarPlay into ALFRED components.
 * Manages CarPlay lifecycle and provides voice interaction callbacks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  type CarPlayMode,
  type CarPlayState,
  carPlayController,
} from "../lib/carplay";
import { useSyncStatus } from "../lib/sync/hooks";
import { trpc } from "../utils/trpc";

interface UseCarPlayOptions {
  /** Mode: 'simple' for basic voice, 'orchestrator' for full workflow control */
  mode?: CarPlayMode;
  /** Legacy: Direct voice input handler (used in simple mode) */
  onVoiceInput?: (transcript: string) => Promise<string>;
  /** TTS handler */
  speakText?: (text: string) => Promise<void>;
  /** Cookie accessor for authenticated requests */
  getCookie?: () => string | null;
  /** Base URL for voice streaming */
  baseUrl?: string | null;
}

interface UseCarPlayReturn {
  isConnected: boolean;
  state: CarPlayState;
  mode: CarPlayMode;
  startVoiceInteraction: () => void;
  processVoiceInput: (transcript: string) => Promise<void>;
  handleStreamChunk: (chunk: string) => void;
}

export function useCarPlay(options: UseCarPlayOptions = {}): UseCarPlayReturn {
  const [state, setState] = useState<CarPlayState>("disconnected");
  const { isOnline } = useSyncStatus();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const trpcClient = trpc.useUtils().client;

  useEffect(() => {
    // CarPlay is iOS only
    if (Platform.OS !== "ios") {
      return;
    }

    carPlayController.initialize({
      trpc: trpcClient,
      mode: optionsRef.current.mode ?? "orchestrator",
      onStateChange: setState,
      onVoiceInput: async (transcript) =>
        optionsRef.current.onVoiceInput?.(transcript) ?? "",
      speakText: async (text) => {
        await optionsRef.current.speakText?.(text);
      },
      isOnline: () => isOnline,
      getCookie: optionsRef.current.getCookie,
      baseUrl: optionsRef.current.baseUrl,
    });

    return () => {
      carPlayController.cleanup();
    };
  }, [trpcClient]);

  // Handle network status changes
  useEffect(() => {
    if (Platform.OS === "ios") {
      carPlayController.handleNetworkChange(isOnline);
    }
  }, [isOnline]);

  const startVoiceInteraction = useCallback(() => {
    if (Platform.OS === "ios") {
      carPlayController.startVoiceInteraction();
    }
  }, []);

  const processVoiceInput = useCallback(async (transcript: string) => {
    if (Platform.OS === "ios") {
      await carPlayController.processVoiceInput(transcript);
    }
  }, []);

  const handleStreamChunk = useCallback((chunk: string) => {
    if (Platform.OS === "ios") {
      carPlayController.handleStreamChunk(chunk);
    }
  }, []);

  return {
    isConnected: state !== "disconnected",
    state,
    mode: carPlayController.getMode(),
    startVoiceInteraction,
    processVoiceInput,
    handleStreamChunk,
  };
}
