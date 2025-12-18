import type {
  VoiceStreamCodec,
  VoiceStreamServerEvent,
} from "@alfred/type/voice";
import type {
  VoiceStreamClient,
  VoiceStreamClientHandlers,
} from "@alfred/voice/stream";
import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceStreamUrl } from "@/utils/voice-stream";

export type VoiceProtocolState = {
  status:
    | "idle"
    | "connecting"
    | "recording"
    | "processing"
    | "playing"
    | "error";
  transcript: string;
  assistantText: string;
  vadConfidence: number | null;
  autoStopReason: string | null;
  error: string | null;
  sessionId: string | null;
};

export function useVoiceProtocol(
  sessionIdRef: React.MutableRefObject<string>,
  handlers: {
    onAudioChunk: (
      chunk: Extract<VoiceStreamServerEvent, { type: "tts_chunk" }>
    ) => void;
    onInterrupt: () => void;
  }
) {
  const streamUrl = getVoiceStreamUrl();
  const clientRef = useRef<VoiceStreamClient | null>(null);
  const [state, setState] = useState<VoiceProtocolState>({
    status: "idle",
    transcript: "",
    assistantText: "",
    vadConfidence: null,
    autoStopReason: null,
    error: null,
    sessionId: null,
  });

  const streamHandlers = useRef<VoiceStreamClientHandlers>({
    onSessionStarted: (event) => {
      setState((prev) => ({
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
    onPartialTranscript: (event) =>
      setState((prev) => ({ ...prev, transcript: event.text })),
    onFinalTranscript: (event) =>
      setState((prev) => ({ ...prev, transcript: event.text })),
    onVadState: (event) =>
      setState((prev) => ({
        ...prev,
        vadConfidence: event.vadConfidence ?? null,
      })),
    onAutoStop: (event) => {
      setState((prev) => ({
        ...prev,
        autoStopReason: event.reason,
        status: "processing",
      }));
    },
    onAssistantMessage: (event) =>
      setState((prev) => ({ ...prev, assistantText: event.text })),
    onTtsChunk: handlers.onAudioChunk,
    onTtsComplete: () => setState((prev) => ({ ...prev, status: "idle" })),
    onInterrupt: () => {
      handlers.onInterrupt();
      setState((prev) => ({ ...prev, status: "recording" }));
    },
    onStatus: (event) => setState((prev) => ({ ...prev, status: event.state })),
    onError: (event) =>
      setState((prev) => ({ ...prev, status: "error", error: event.message })),
  }).current;

  const getClient = useCallback(() => {
    if (!streamUrl) {
      throw new Error("voice_stream_url_missing");
    }
    if (clientRef.current) {
      return clientRef.current;
    }

    // Dynamically import to avoid server-side issues if needed, though VoiceStreamClient is pure JS
    const { VoiceStreamClient } = require("@alfred/voice/stream");
    const client = new VoiceStreamClient({ url: streamUrl }, streamHandlers);
    clientRef.current = client;
    return client;
  }, [streamUrl, streamHandlers]);

  const connect = useCallback(
    async (config: {
      surface: string;
      codec: VoiceStreamCodec;
      vadThreshold?: number;
      maxUtteranceMs?: number;
    }) => {
      setState((prev) => ({ ...prev, status: "connecting", error: null }));
      try {
        const client = getClient();
        await client.startSession({
          sessionId: sessionIdRef.current,
          surface: config.surface,
          codec: config.codec,
          vadThreshold: config.vadThreshold,
          maxUtteranceMs: config.maxUtteranceMs,
        });
        return client;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "connection_failed",
        }));
        throw err;
      }
    },
    [getClient, sessionIdRef]
  );

  const disconnect = useCallback(
    async (reason: "manual" | "silence" | "timeout" = "manual") => {
      try {
        await clientRef.current?.stop(reason);
      } catch (_err) {
        // ignore stop errors
      }
    },
    []
  );

  useEffect(
    () => () => {
      clientRef.current?.close();
      clientRef.current = null;
    },
    []
  );

  return {
    state,
    connect,
    disconnect,
    getClient,
    supported: Boolean(streamUrl),
  };
}
