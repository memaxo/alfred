/**
 * App Preferences Hook
 *
 * Persists app state to tRPC preferences API.
 * Provides typed getters/setters for common preferences.
 */

import { useCallback, useEffect, useMemo } from "react";

import { trpc } from "@/utils/trpc";

// Preference keys
export const PREF_KEYS = {
  THEME: "app.theme",
  AGENT_MODE: "app.agent.mode",
  VOICE_ENABLED: "app.voice.enabled",
  VOICE_VOICE_ID: "app.voice.voiceId",
  REDUCED_MOTION: "app.reduced_motion",
  HAPTICS_ENABLED: "app.haptics.enabled",
  CHAT_THREAD_ID: "app.chat.threadId",
} as const;

export type AgentMode =
  | "assistant"
  | "orchestrator"
  | "researcher"
  | "executor"
  | "coder"
  | "chat";
export type ThemeMode = "light" | "dark" | "system";

interface AppPreferences {
  theme: ThemeMode;
  agentMode: AgentMode;
  voiceEnabled: boolean;
  voiceId: string | null;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
  chatThreadId: string | null;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "system",
  agentMode: "assistant",
  voiceEnabled: true,
  voiceId: null,
  reducedMotion: false,
  hapticsEnabled: true,
  chatThreadId: null,
};

export function useAppPreferences() {
  const utils = trpc.useUtils();

  // Fetch all preferences
  const {
    data: rawPreferences,
    isLoading,
    refetch,
  } = trpc.preference.list.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Set preference mutation
  const setMutation = trpc.preference.set.useMutation({
    onSuccess: () => {
      utils.preference.list.invalidate();
    },
  });

  // Parse preferences into typed object
  const preferences = useMemo<AppPreferences>(() => {
    if (!rawPreferences) return DEFAULT_PREFERENCES;

    const prefMap = new Map(rawPreferences.map((p) => [p.key, p.value]));

    return {
      theme:
        (prefMap.get(PREF_KEYS.THEME) as ThemeMode) ??
        DEFAULT_PREFERENCES.theme,
      agentMode:
        (prefMap.get(PREF_KEYS.AGENT_MODE) as AgentMode) ??
        DEFAULT_PREFERENCES.agentMode,
      voiceEnabled: prefMap.has(PREF_KEYS.VOICE_ENABLED)
        ? prefMap.get(PREF_KEYS.VOICE_ENABLED) === "true"
        : DEFAULT_PREFERENCES.voiceEnabled,
      voiceId:
        (prefMap.get(PREF_KEYS.VOICE_VOICE_ID) as string | null) ??
        DEFAULT_PREFERENCES.voiceId,
      reducedMotion: prefMap.has(PREF_KEYS.REDUCED_MOTION)
        ? prefMap.get(PREF_KEYS.REDUCED_MOTION) === "true"
        : DEFAULT_PREFERENCES.reducedMotion,
      hapticsEnabled: prefMap.get(PREF_KEYS.HAPTICS_ENABLED) !== "false", // Default true
      chatThreadId:
        (prefMap.get(PREF_KEYS.CHAT_THREAD_ID) as string | null) ??
        DEFAULT_PREFERENCES.chatThreadId,
    };
  }, [rawPreferences]);

  // Setters
  const setTheme = useCallback(
    (theme: ThemeMode) => {
      setMutation.mutate({ key: PREF_KEYS.THEME, value: theme });
    },
    [setMutation]
  );

  const setAgentMode = useCallback(
    (mode: AgentMode) => {
      setMutation.mutate({ key: PREF_KEYS.AGENT_MODE, value: mode });
    },
    [setMutation]
  );

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setMutation.mutate({
        key: PREF_KEYS.VOICE_ENABLED,
        value: String(enabled),
      });
    },
    [setMutation]
  );

  const setVoiceId = useCallback(
    (voiceId: string | null) => {
      if (voiceId) {
        setMutation.mutate({ key: PREF_KEYS.VOICE_VOICE_ID, value: voiceId });
      }
    },
    [setMutation]
  );

  const setReducedMotion = useCallback(
    (enabled: boolean) => {
      setMutation.mutate({
        key: PREF_KEYS.REDUCED_MOTION,
        value: String(enabled),
      });
    },
    [setMutation]
  );

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      setMutation.mutate({
        key: PREF_KEYS.HAPTICS_ENABLED,
        value: String(enabled),
      });
    },
    [setMutation]
  );

  const setChatThreadId = useCallback(
    (threadId: string | null) => {
      if (threadId) {
        setMutation.mutate({ key: PREF_KEYS.CHAT_THREAD_ID, value: threadId });
      }
    },
    [setMutation]
  );

  return {
    preferences,
    isLoading,
    isPending: setMutation.isPending,
    refetch,
    // Setters
    setTheme,
    setAgentMode,
    setVoiceEnabled,
    setVoiceId,
    setReducedMotion,
    setHapticsEnabled,
    setChatThreadId,
  };
}

// Hook for individual preference with optimistic updates
export function usePreference<K extends keyof AppPreferences>(
  key: K
): [AppPreferences[K], (value: AppPreferences[K]) => void, boolean] {
  const {
    preferences,
    isLoading,
    setTheme,
    setAgentMode,
    setVoiceEnabled,
    setVoiceId,
    setReducedMotion,
    setHapticsEnabled,
    setChatThreadId,
  } = useAppPreferences();

  const setValue = useCallback(
    (value: AppPreferences[K]) => {
      switch (key) {
        case "theme":
          setTheme(value as ThemeMode);
          break;
        case "agentMode":
          setAgentMode(value as AgentMode);
          break;
        case "voiceEnabled":
          setVoiceEnabled(value as boolean);
          break;
        case "voiceId":
          setVoiceId(value as string | null);
          break;
        case "reducedMotion":
          setReducedMotion(value as boolean);
          break;
        case "hapticsEnabled":
          setHapticsEnabled(value as boolean);
          break;
        case "chatThreadId":
          setChatThreadId(value as string | null);
          break;
      }
    },
    [
      key,
      setTheme,
      setAgentMode,
      setVoiceEnabled,
      setVoiceId,
      setReducedMotion,
      setHapticsEnabled,
      setChatThreadId,
    ]
  );

  return [preferences[key], setValue, isLoading];
}
