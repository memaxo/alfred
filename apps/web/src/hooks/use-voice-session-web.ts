import { createVoiceSession } from "@alfred/voice/session";
import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  VoiceClient,
  VoiceSessionDescriptor,
} from "@alfred/voice/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dispatchMindscapeEvent } from "@/hooks/use-mindscape-activations";
import { trpc } from "@/utils/trpc";
import { useVoiceAudio } from "./use-voice-audio";
import { useVoiceProtocol } from "./use-voice-protocol";

type SpeechOverrides = Partial<
  Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">
>;

// Telemetry loop interval
const TELEMETRY_INTERVAL_MS = 5000;

export function useVoiceSessionWeb() {
  const sttMutation = trpc.voice.sttTranscribe.useMutation();
  const ttsMutation = trpc.voice.ttsSynthesize.useMutation();
  const s2sMutation = trpc.voice.speechToSpeech.useMutation();

  // --- State ---
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] =
    useState<SpeechToSpeechResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionDescriptor | null>(
    null
  );

  // We use a ref for session ID to maintain identity across re-renders without triggering effects
  // Initial ID is generated client-side
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `voice-${Date.now()}`
  );

  // --- Sub-Hooks ---
  const audio = useVoiceAudio();

  const protocol = useVoiceProtocol(sessionIdRef, {
    onAudioChunk: async (chunk) => {
      // Decode if needed? Protocol delivers Base64.
      // use-voice-protocol passes the raw event.
      // We need to convert base64 -> Float32 for worklet.
      // For now, let's do a simple base64 decode to float32 buffer here?
      // Or move `pcm16Base64ToFloat32` to a shared util usable by hooks.
      const { pcm16Base64ToFloat32 } = await import("@alfred/voice/audio");
      const floatData = pcm16Base64ToFloat32(chunk.audioBase64);
      audio.playAudio(floatData);

      // Visualize TTS Output
      dispatchMindscapeEvent({
        type: "voice-output",
        sourceId: "voice-session",
        targetId: "user",
      });
    },
    onInterrupt: () => {
      audio.clearAudio();
    },
  });

  // --- Telemetry State ---
  const telemetryRef = useRef<{
    lastTime: number;
    jitterBuffer: number[];
    packetLoss: number;
    seq: number;
    interval: ReturnType<typeof setInterval> | null;
  }>({
    lastTime: 0,
    jitterBuffer: [],
    packetLoss: 0,
    seq: 0,
    interval: null,
  });

  // --- Preferences & Session Sync ---
  const { data: prefs } = trpc.user.getPreferences.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: sessionData, refetch: refetchSessions } =
    trpc.voice.sessions.useQuery(undefined, {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    });

  const syncSessionInfo = useCallback(
    (snapshot: VoiceSessionDescriptor | null) => {
      if (snapshot?.id) sessionIdRef.current = snapshot.id;
      setSessionInfo(snapshot);
    },
    []
  );

  useEffect(() => {
    if (sessionData && sessionData.length > 0) syncSessionInfo(sessionData[0]);
  }, [sessionData, syncSessionInfo]);

  // --- Actions ---

  const startStreaming = useCallback(
    async (options?: { vadThreshold?: number; maxUtteranceMs?: number }) => {
      if (!protocol.supported) throw new Error("voice_streaming_unavailable");

      // Resolve Codec
      const sessionCodec = sessionInfo?.codec?.output;
      const prefsCodec = prefs?.find((p: any) => p.key === "voice.codec")
        ?.value as string;
      const codec = (prefsCodec || sessionCodec || "mp3") as any;

      const client = await protocol.connect({
        surface: "web",
        codec,
        vadThreshold: options?.vadThreshold,
        maxUtteranceMs: options?.maxUtteranceMs,
      });

      // Start Audio Capture
      await audio.startCapture(
        client,
        () => {
          // Speech Start (Barge-in handled in useVoiceAudio + protocol interrupt)
          dispatchMindscapeEvent({
            type: "voice-input",
            sourceId: "user", // Assumes UserNode is "user"
            targetId: "voice-session", // Assumes VoiceSessionNode is "voice-session" (if exists) or pulsing "user" output
          });
        },
        () => {
          // Speech End
        }
      );

      // Start Telemetry
      if (telemetryRef.current.interval)
        clearInterval(telemetryRef.current.interval);
      telemetryRef.current.interval = setInterval(() => {
        const { jitterBuffer, packetLoss } = telemetryRef.current;
        if (jitterBuffer.length === 0 && packetLoss === 0) return;

        const avgJitter =
          jitterBuffer.length > 0
            ? jitterBuffer.reduce((a, b) => a + b, 0) / jitterBuffer.length
            : 0;

        client.sendTelemetry?.({ packetLoss, jitter: avgJitter, rtt: 0 }); // RTT TODO

        telemetryRef.current.jitterBuffer = [];
        telemetryRef.current.packetLoss = 0;
      }, TELEMETRY_INTERVAL_MS);
    },
    [protocol, audio, sessionInfo, prefs]
  );

  const stopStreaming = useCallback(
    async (reason?: "manual" | "silence" | "timeout") => {
      if (telemetryRef.current.interval) {
        clearInterval(telemetryRef.current.interval);
        telemetryRef.current.interval = null;
      }
      audio.stopCapture();
      await protocol.disconnect(reason);
    },
    [audio, protocol]
  );

  // Legacy REST Actions (VoiceSession)
  const voiceClient = useMemo<VoiceClient>(
    () => ({
      sttTranscribe: (input) => sttMutation.mutateAsync(input),
      ttsSynthesize: (input) => ttsMutation.mutateAsync(input),
      speechToSpeech: (input) => s2sMutation.mutateAsync(input),
    }),
    [s2sMutation, sttMutation, ttsMutation]
  );

  // Adapter for legacy createVoiceSession (mostly for REST fallback)
  const adapter = useMemo(
    () => ({
      configureSession: async () => {},
      startCapture: async () => {}, // No-op for REST
      stopCapture: async () => null,
      play: async () => {},
      stopAudio: () => audio.clearAudio(),
    }),
    [audio]
  );

  const session = useMemo(
    () => createVoiceSession(adapter, voiceClient),
    [adapter, voiceClient]
  );

  // Cleanup
  useEffect(
    () => () => {
      if (telemetryRef.current.interval)
        clearInterval(telemetryRef.current.interval);
      audio.stopCapture();
      protocol.disconnect("manual");
    },
    [audio, protocol]
  );

  return {
    state: session.state, // Legacy state (mostly idle for streaming)
    isRecording, // TODO: wire to protocol state
    isProcessing: protocol.state.status === "processing" || isProcessing,
    lastResponse,
    error: protocol.state.error || error,
    start: async () => {}, // Legacy
    stopAndTranscribe: async () => {}, // Legacy
    speechToSpeech: async () => {}, // Legacy
    speak: async () => {},
    clear: () => {
      session.clear();
      setLastResponse(null);
      setError(null);
    },
    session: sessionInfo,
    refreshSession: async () => {
      const res = await refetchSessions();
      return res.data?.[0] || null;
    },
    stream: {
      supported: protocol.supported,
      status: protocol.state.status,
      transcript: protocol.state.transcript,
      assistantText: protocol.state.assistantText,
      vadConfidence: protocol.state.vadConfidence,
      autoStopReason: protocol.state.autoStopReason,
      error: protocol.state.error,
      isActive:
        protocol.state.status !== "idle" && protocol.state.status !== "error",
      sessionId: protocol.state.sessionId,
      analyser: audio.analyser,
      start: startStreaming,
      stop: stopStreaming,
    },
  };
}
