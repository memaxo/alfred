import type { VoiceStreamCodec } from "@alfred/type/voice";
import type {
  SpeechToSpeechResponse,
  VoiceClient,
  VoiceSessionDescriptor,
} from "@alfred/voice/types";

import { createVoiceSession } from "@alfred/voice/session";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dispatchDesktopEvent } from "@/hooks/use-desktop-activations";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import { useVoiceAudio } from "./use-voice-audio";
import { useVoiceProtocol } from "./use-voice-protocol";
import { useVoiceWebrtcProtocol } from "./use-voice-webrtc-protocol";

// Telemetry loop interval
const TELEMETRY_INTERVAL_MS = 5000;

export function useVoiceSessionWeb() {
  const isTestMode =
    import.meta.env.VITE_TEST_MODE === "true" ||
    import.meta.env.MINDSCAPE_TEST === "1";

  const sttMutation = trpc.voice.sttTranscribe.useMutation();
  const ttsMutation = trpc.voice.ttsSynthesize.useMutation();
  const s2sMutation = trpc.voice.speechToSpeech.useMutation();

  // --- State ---
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
      // Track RTT based on time elapsed since last telemetry send
      if (telemetryRef.current.lastTelemetrySendTime > 0) {
        const rtt = Date.now() - telemetryRef.current.lastTelemetrySendTime;
        telemetryRef.current.rttBuffer.push(rtt);
      }

      // Decode if needed? Protocol delivers Base64.
      // use-voice-protocol passes the raw event.
      // We need to convert base64 -> Float32 for worklet.
      // For now, let's do a simple base64 decode to float32 buffer here?
      // Or move `pcm16Base64ToFloat32` to a shared util usable by hooks.
      const { pcm16Base64ToFloat32 } = await import("@alfred/voice/audio");
      const floatData = pcm16Base64ToFloat32(chunk.audioBase64);
      audio.playAudio(floatData);

      // Visualize TTS Output
      dispatchDesktopEvent({
        type: "voice-output",
        sourceId: "voice-session",
        targetId: "user",
      });
    },
    onInterrupt: () => {
      audio.clearAudio();
    },
  });

  const webrtc = useVoiceWebrtcProtocol(sessionIdRef, {
    onInterrupt: () => {
      audio.clearAudio();
    },
  });

  const lastWorkflowRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    const raw = webrtc.state.assistantRaw ?? protocol.state.assistantRaw;
    const runId = raw?.meta?.runId;
    const planId = raw?.meta?.planId;
    if (typeof runId !== "string" || runId.length === 0) {
      return;
    }
    if (lastWorkflowRunIdRef.current === runId) {
      return;
    }

    const store = useDesktopStore.getState();
    if (!store.isSpaceMode) {
      return;
    }

    lastWorkflowRunIdRef.current = runId;

    const existing = store.windows.find((w) => {
      const data = w.data as
        | { runId?: unknown; resourceRef?: { id?: unknown } }
        | undefined;
      return data?.runId === runId || data?.resourceRef?.id === runId;
    });

    const windowId =
      existing?.id ??
      store.spawnWindow("workflow", {
        type: "workflow_run",
        id: runId,
      });

    store.updateWindowData(windowId, {
      runId,
      planId: typeof planId === "string" ? planId : undefined,
    });
    store.focusWindow(windowId);
  }, [protocol.state.assistantRaw, webrtc.state.assistantRaw]);

  // --- Telemetry State ---
  const telemetryRef = useRef<{
    lastTelemetrySendTime: number;
    jitterBuffer: number[];
    packetLoss: number;
    rttBuffer: number[];
    interval: ReturnType<typeof setInterval> | null;
  }>({
    lastTelemetrySendTime: 0,
    jitterBuffer: [],
    packetLoss: 0,
    rttBuffer: [],
    interval: null,
  });

  // --- Preferences & Session Sync ---
  const { data: prefs } = trpc.user.getPreferences.useQuery(undefined, {
    staleTime: 60_000,
    enabled: !isTestMode,
  });
  const { data: sessionData, refetch: refetchSessions } =
    trpc.voice.sessions.useQuery(undefined, {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      enabled: !isTestMode,
    });

  const syncSessionInfo = useCallback(
    (snapshot: VoiceSessionDescriptor | null) => {
      if (snapshot?.id) {
        sessionIdRef.current = snapshot.id;
      }
      setSessionInfo(snapshot);
    },
    []
  );

  useEffect(() => {
    if (sessionData && sessionData.length > 0) {
      // sessionData items are compatible with VoiceSessionDescriptor
      syncSessionInfo(sessionData[0] as VoiceSessionDescriptor);
    }
  }, [sessionData, syncSessionInfo]);

  // --- Actions ---

  const startStreaming = useCallback(
    async (options?: { vadThreshold?: number; maxUtteranceMs?: number }) => {
      if (isTestMode) {
        return;
      }
      if (webrtc.supported) {
        try {
          await webrtc.start({
            vadThreshold: options?.vadThreshold,
            maxUtteranceMs: options?.maxUtteranceMs,
          });
          return;
        } catch (error) {
          // Fall back to WS streaming if WebRTC setup fails (or server feature is off).
          setError(
            error instanceof Error ? error.message : "voice_webrtc_failed"
          );
        }
      }
      if (!protocol.supported) {
        throw new Error("voice_streaming_unavailable");
      }

      // Streaming playback currently assumes PCM16 → Float32 for the audio worklet.
      // Keep streaming codec fixed to "pcm" until we add compressed-audio playback.
      const codec = "pcm" satisfies VoiceStreamCodec;

      const rawChunkSize = prefs?.find((p) => p.key === "voice.stt.chunk_size")
        ?.value as string | undefined;
      const sttChunkSize =
        rawChunkSize === "fast" ||
        rawChunkSize === "low" ||
        rawChunkSize === "medium" ||
        rawChunkSize === "accurate"
          ? rawChunkSize
          : undefined;

      const client = await protocol.connect({
        surface: "web",
        codec,
        inputMimeType: "audio/raw;codec=pcm_s16le;rate=16000",
        sttChunkSize,
        vadThreshold: options?.vadThreshold,
        maxUtteranceMs: options?.maxUtteranceMs,
      });

      // Start Audio Capture
      await audio.startCapture(
        client,
        () => {
          // Speech Start (Barge-in handled in useVoiceAudio + protocol interrupt)
          dispatchDesktopEvent({
            type: "voice-input",
            sourceId: "user",
            targetId: "voice-session",
          });
        },
        () => {
          // Speech End
        }
      );

      // Start Telemetry
      if (telemetryRef.current.interval) {
        clearInterval(telemetryRef.current.interval);
      }
      telemetryRef.current.interval = setInterval(() => {
        const { jitterBuffer, packetLoss, rttBuffer } = telemetryRef.current;
        if (jitterBuffer.length === 0 && packetLoss === 0) {
          return;
        }

        const avgJitter =
          jitterBuffer.length > 0
            ? jitterBuffer.reduce((a, b) => a + b, 0) / jitterBuffer.length
            : 0;

        const avgRtt =
          rttBuffer.length > 0
            ? rttBuffer.reduce((a, b) => a + b, 0) / rttBuffer.length
            : 0;

        telemetryRef.current.lastTelemetrySendTime = Date.now();
        client.sendTelemetry?.({
          packetLoss,
          jitter: avgJitter,
          rtt: avgRtt,
        });

        telemetryRef.current.jitterBuffer = [];
        telemetryRef.current.packetLoss = 0;
        telemetryRef.current.rttBuffer = [];
      }, TELEMETRY_INTERVAL_MS);
    },
    [protocol, audio, sessionInfo, prefs]
  );

  const stopStreaming = useCallback(
    async (reason?: "manual" | "silence" | "timeout") => {
      if (webrtc.supported && webrtc.state.sessionId) {
        await webrtc.stop(reason ?? "manual");
        return;
      }
      if (telemetryRef.current.interval) {
        clearInterval(telemetryRef.current.interval);
        telemetryRef.current.interval = null;
      }
      audio.stopCapture();
      await protocol.disconnect(reason);
    },
    [audio, protocol, webrtc]
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
      if (telemetryRef.current.interval) {
        clearInterval(telemetryRef.current.interval);
      }
      audio.stopCapture();
      protocol.disconnect("manual");
    },
    [audio, protocol]
  );

  return {
    state: session.state,
    isRecording: protocol.state.status === "recording",
    isProcessing: protocol.state.status === "processing",
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
      supported: webrtc.supported || protocol.supported,
      transport: webrtc.state.sessionId
        ? ("webrtc" as const)
        : (protocol.state.sessionId
          ? ("ws" as const)
          : null),
      status: webrtc.state.sessionId
        ? webrtc.state.status
        : protocol.state.status,
      transcript: webrtc.state.sessionId
        ? webrtc.state.transcript
        : protocol.state.transcript,
      assistantText: webrtc.state.sessionId
        ? webrtc.state.assistantText
        : protocol.state.assistantText,
      raw: webrtc.state.sessionId
        ? webrtc.state.assistantRaw
        : protocol.state.assistantRaw,
      uiMessages: webrtc.state.sessionId
        ? webrtc.state.uiMessages
        : protocol.state.uiMessages,
      workflow: webrtc.state.sessionId
        ? webrtc.state.workflow
        : protocol.state.workflow,
      vadConfidence: webrtc.state.sessionId
        ? webrtc.state.vadConfidence
        : protocol.state.vadConfidence,
      autoStopReason: webrtc.state.sessionId
        ? webrtc.state.autoStopReason
        : protocol.state.autoStopReason,
      error: webrtc.state.sessionId ? webrtc.state.error : protocol.state.error,
      isActive: webrtc.state.sessionId
        ? webrtc.state.status !== "idle" && webrtc.state.status !== "error"
        : protocol.state.status !== "idle" && protocol.state.status !== "error",
      sessionId: webrtc.state.sessionId
        ? webrtc.state.sessionId
        : protocol.state.sessionId,
      analyser: audio.analyser,
      start: startStreaming,
      stop: stopStreaming,
    },
  };
}
