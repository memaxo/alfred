import type { UIMessage } from "@alfred/type/stream";
import type {
  VoiceAssistantRaw,
  VoiceStreamCodec,
  VoiceStreamServerEvent,
  VoiceStreamSurface,
} from "@alfred/type/voice";
import { parseVoiceAssistantRaw } from "@alfred/type/voice.zod";
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
  assistantRaw: VoiceAssistantRaw | null;
  uiMessages: UIMessage[];
  workflow: { runId: string; planId?: string } | null;
};

export function useVoiceProtocol(
  sessionIdRef: React.MutableRefObject<string>,
  handlers: {
    onAudioChunk: (
      chunk: Extract<VoiceStreamServerEvent, { _: "tts_chunk" }>
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
    assistantRaw: null,
    uiMessages: [],
    workflow: null,
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
        assistantRaw: null,
        uiMessages: [],
        workflow: null,
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
    onAssistantMessage: (event) => {
      const raw = event.raw;
      const parsed =
        raw === undefined
          ? { ok: false as const, error: "missing" }
          : parseVoiceAssistantRaw(raw);
      const assistantRaw = parsed.ok ? parsed.value : null;
      const meta = assistantRaw?.meta;
      const runId = meta?.runId;
      const planId = meta?.planId;
      const workflow =
        typeof runId === "string" && runId.length > 0
          ? { runId, planId: typeof planId === "string" ? planId : undefined }
          : null;

      setState((prev) => ({
        ...prev,
        assistantText: event.text,
        assistantRaw,
        uiMessages: assistantRaw?.uiMessages ?? [],
        workflow,
      }));
    },
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

  const getClient = useCallback(async () => {
    if (!streamUrl) {
      throw new Error("voice_stream_url_missing");
    }
    if (clientRef.current) {
      return clientRef.current;
    }

    const { VoiceStreamClient } = await import("@alfred/voice/stream");
    const client = new VoiceStreamClient({ url: streamUrl }, streamHandlers);
    clientRef.current = client;
    return client;
  }, [streamUrl, streamHandlers]);

  const connect = useCallback(
    async (config: {
      surface: VoiceStreamSurface;
      codec: VoiceStreamCodec;
      vadThreshold?: number;
      maxUtteranceMs?: number;
      sttChunkSize?: "fast" | "low" | "medium" | "accurate";
      inputMimeType?: string;
    }) => {
      setState((prev) => ({ ...prev, status: "connecting", error: null }));
      try {
        const client = await getClient();
        await client.startSession({
          sessionId: sessionIdRef.current,
          surface: config.surface,
          codec: config.codec,
          vadThreshold: config.vadThreshold,
          maxUtteranceMs: config.maxUtteranceMs,
          sttChunkSize: config.sttChunkSize,
          inputMimeType: config.inputMimeType,
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
