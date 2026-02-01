import type { UIMessage } from "@alfred/type/stream";
import type {
  VoiceAssistantRaw,
  VoiceStreamCodec,
  VoiceStreamServerEvent,
} from "@alfred/type/voice";
import type { PlatformAdapter } from "@alfred/voice";
import type {
  SpeechToSpeechRequest,
  SttRequest,
  TtsRequest,
  VoiceSessionDescriptor,
  VoiceSessionSurface,
} from "@alfred/voice/types";
import type RnMediaStream from "react-native-webrtc/lib/typescript/MediaStream";
import type RnDataChannel from "react-native-webrtc/lib/typescript/RTCDataChannel";
import type RnPeerConnection from "react-native-webrtc/lib/typescript/RTCPeerConnection";

import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import { parseVoiceAssistantRaw } from "@alfred/type/voice.zod";
import { wrapPCM16AsWavBase64 } from "@alfred/voice/audio";
import { createVoiceSession, VoiceSessionError } from "@alfred/voice/session";
import { VoiceStreamClient } from "@alfred/voice/stream";
import { createVoiceClient } from "@alfred/voice/transport";
import { Audio } from "expo-av";
import { deleteAsync, EncodingType, readAsStringAsync } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, NativeModules, Platform } from "react-native";

import type { VoiceS2SPayload } from "./voice.types";

import { ExpoCapture } from "./capture";
import { configureAudioSession } from "./config";
import { getVoiceStreamUrl } from "./env";
import { playBase64 } from "./play";
import { enqueue } from "./queue";

interface MutationAdapter {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
}

type MutationInvoker = (path: string, input: unknown) => Promise<unknown>;
type QueryInvoker = (path: string, input?: unknown) => Promise<unknown>;

function hasMutationInvoker(
  value: unknown
): value is { mutation: MutationInvoker } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { mutation?: unknown }).mutation === "function"
  );
}

function hasQueryInvoker(value: unknown): value is { query: QueryInvoker } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { query?: unknown }).query === "function"
  );
}

function hasMutate(
  value: unknown
): value is { mutate: (input: unknown) => Promise<unknown> } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { mutate?: unknown }).mutate === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveMutation(
  rawClient: unknown,
  path: string,
  input: unknown
): Promise<unknown> {
  const segments = path.split(".");
  let cursor: unknown = rawClient;

  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      cursor = null;
      break;
    }
    const t = cursor as unknown as Record<string, unknown>;
    const next = t[segment];
    if (next === undefined) {
      cursor = null;
      break;
    }
    cursor = next;
  }

  if (hasMutate(cursor)) {
    return cursor.mutate(input);
  }

  if (hasMutationInvoker(rawClient)) {
    return rawClient.mutation(path, input);
  }

  throw new Error(`tRPC client missing mutation handler for ${path}`);
}

function hasQuery(
  value: unknown
): value is { query: (input: unknown) => Promise<unknown> } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { query?: unknown }).query === "function"
  );
}

function resolveQuery(
  rawClient: unknown,
  path: string,
  input?: unknown
): Promise<unknown> {
  const segments = path.split(".");
  let cursor: unknown = rawClient;

  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      cursor = null;
      break;
    }
    const t = cursor as unknown as Record<string, unknown>;
    const next = t[segment];
    if (next === undefined) {
      cursor = null;
      break;
    }
    cursor = next;
  }

  if (hasQuery(cursor)) {
    return cursor.query(input);
  }
  if (hasQueryInvoker(rawClient)) {
    return rawClient.query(path, input);
  }
  throw new Error(`tRPC client missing query handler for ${path}`);
}

function toMutationAdapter(trpc: unknown): MutationAdapter {
  return {
    mutation: <TInput, TOutput>(path: string, input: TInput) =>
      resolveMutation(trpc, path, input) as Promise<TOutput>,
  };
}

interface VoiceSessionNativeOptions {
  mode?: "classic" | "s2s";
  surface?: VoiceSessionSurface;
  /**
   * Cookie accessor used for authenticated WebSocket streaming.
   * Required on native where cookies are not automatically attached to WS.
   */
  getCookie?: () => string | null;
  /**
   * Base URL for voice streaming WebSocket resolution.
   * If omitted, falls back to `EXPO_PUBLIC_SERVER_URL` (build-time default).
   */
  baseUrl?: string | null;
  /**
   * Optional Nemotron streaming chunk size (latency/accuracy).
   * If omitted, the server default is used.
   */
  sttChunkSize?: "fast" | "low" | "medium" | "accurate";
  speechDefaults?: Partial<
    Pick<
      SpeechToSpeechRequest,
      "thread" | "resource" | "ttsVoice" | "ttsFormat" | "language" | "prompt"
    >
  >;
}

type StreamStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "processing"
  | "playing"
  | "error";

interface NativeStreamState {
  supported: boolean;
  status: StreamStatus;
  transport: "webrtc" | "ws" | null;
  transcript: string;
  assistantText: string;
  assistantRaw: VoiceAssistantRaw | null;
  uiMessages: UIMessage[];
  workflow: { runId: string; planId?: string } | null;
  vadConfidence: number | null;
  autoStopReason: string | null;
  error: string | null;
  sessionId: string | null;
}

const STREAM_CHUNK_MS = 1200;
const STREAM_TIMEOUT_MS = 20_000;
const STREAM_CAPTURE_MIME = "audio/m4a";
const WEBRTC_POLL_MS = 200;

function generateVoiceSessionId() {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `voice-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const maybeBuffer = (globalThis as unknown as { Buffer?: unknown }).Buffer as
    | { from: (input: string, encoding: "base64") => Uint8Array }
    | undefined;
  if (maybeBuffer?.from) {
    return maybeBuffer.from(value, "base64");
  }

  const decode = (globalThis as unknown as { atob?: (input: string) => string })
    .atob;
  if (!decode) {
    throw new Error("base64_decode_unavailable");
  }

  const binary = decode(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes;
}

interface RtcIceServer {
  credential?: string;
  url?: string;
  urls?: string | string[];
  username?: string;
}

interface EventTargetLike {
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  [key: string]: unknown;
}

function addEvt(
  target: unknown,
  type: string,
  listener: (event: unknown) => void
) {
  if (!target) {
    return;
  }
  const t = target as unknown as EventTargetLike;
  if (typeof t.addEventListener === "function") {
    t.addEventListener(type, listener);
    return;
  }
  // Fallback for implementations that only expose `on<Event>` handlers.
  const prop = `on${type}` as const;
  (t as unknown as Record<string, unknown>)[prop] = listener as unknown;
}

function parseIceServers(value: unknown): RtcIceServer[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: RtcIceServer[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const { urls } = item;
    const { url } = item;
    const record: RtcIceServer = {};
    if (
      typeof urls === "string" ||
      (Array.isArray(urls) && urls.every((u) => typeof u === "string"))
    ) {
      record.urls = urls;
    } else if (typeof url === "string") {
      record.url = url;
    } else {
      continue;
    }
    if (typeof item.username === "string") {
      record.username = item.username;
    }
    if (typeof item.credential === "string") {
      record.credential = item.credential;
    }
    out.push(record);
  }
  return out;
}

function parseIceCandidateInfo(value: unknown): {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  const { candidate } = value;
  if (typeof candidate !== "string" || candidate.length === 0) {
    return null;
  }
  const { sdpMLineIndex } = value;
  const { sdpMid } = value;
  return {
    candidate,
    sdpMLineIndex:
      typeof sdpMLineIndex === "number" || sdpMLineIndex === null
        ? sdpMLineIndex
        : undefined,
    sdpMid: typeof sdpMid === "string" || sdpMid === null ? sdpMid : undefined,
  };
}

export function useVoiceSessionNative(
  trpc: unknown,
  options?: VoiceSessionNativeOptions
) {
  const webrtcEnabled = (() => {
    if (Platform.OS === "web") {
      return false;
    }
    // Prefer WebRTC on local dev servers (test-mode backend).
    if (options?.baseUrl) {
      try {
        const url = new URL(options.baseUrl);
        if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
          return true;
        }
      } catch {
        // ignore
      }
    }
    if (process.env.EXPO_PUBLIC_VOICE_WEBRTC === "1") {
      return true;
    }
    if (Platform.OS !== "ios") {
      return false;
    }
    const settings = (NativeModules as unknown as { SettingsManager?: unknown })
      .SettingsManager as { settings?: Record<string, unknown> } | undefined;
    const raw = settings?.settings?.ALFRED_VOICE_WEBRTC;
    return raw === "1" || raw === "true";
  })();
  const captureRef = useMemo(() => ({ current: new ExpoCapture() }), []);
  const mutationAdapter = useMemo(() => toMutationAdapter(trpc), [trpc]);
  const client = useMemo(
    () => createVoiceClient({ trpc: mutationAdapter }),
    [mutationAdapter]
  );
  const preferredMode = options?.mode ?? "s2s";
  const sessionSurface: VoiceSessionSurface = options?.surface ?? "drive";
  const preferSpeechToSpeech = preferredMode !== "classic";
  const speechDefaults = useMemo(
    () => ({
      thread: options?.speechDefaults?.thread,
      resource: options?.speechDefaults?.resource,
      ttsVoice: options?.speechDefaults?.ttsVoice ?? "alloy",
      ttsFormat: options?.speechDefaults?.ttsFormat ?? "mp3",
      language: options?.speechDefaults?.language,
      prompt: options?.speechDefaults?.prompt,
    }),
    [options]
  );
  // Streaming playback on native currently expects PCM16 (wrapped as WAV).
  // Keep streaming codec fixed to "pcm" until we add compressed-audio playback.
  const preferredStreamCodec = useMemo<VoiceStreamCodec>(() => "pcm", []);

  const adapter: PlatformAdapter = useMemo(
    () => ({
      configureSession: (options?: { background?: boolean }) =>
        configureAudioSession(Audio, { background: options?.background }),
      startCapture: () => captureRef.current.start(),
      stopCapture: () => captureRef.current.stop(),
      play: (base64: string, mimeType: string) => playBase64(base64, mimeType),
    }),
    [captureRef]
  );

  const session = useMemo(
    () => createVoiceSession(adapter, client),
    [adapter, client]
  );

  const streamUrlRef = useRef(getVoiceStreamUrl(options?.baseUrl ?? null));
  const [streamState, setStreamState] = useState<NativeStreamState>({
    supported: Boolean(streamUrlRef.current) || webrtcEnabled,
    status: "idle",
    transport: null,
    transcript: "",
    assistantText: "",
    assistantRaw: null,
    uiMessages: [],
    workflow: null,
    vadConfidence: null,
    autoStopReason: null,
    error: null,
    sessionId: null,
  });
  const sessionIdRef = useRef<string>(generateVoiceSessionId());
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionDescriptor | null>(
    null
  );

  const streamClientRef = useRef<VoiceStreamClient | null>(null);
  const transportRef = useRef<"webrtc" | "ws" | null>(null);
  const streamingActiveRef = useRef(false);
  const streamingStopRef = useRef(false);
  const streamingMutedRef = useRef(false);
  const currentRecordingRef = useRef<Audio.Recording | null>(null);
  const playbackQueueRef = useRef<string[]>([]);
  const playbackRunningRef = useRef(false);
  const playbackAbortRef = useRef<AbortController | null>(null);

  const webrtcPcRef = useRef<unknown>(null);
  const webrtcDcRef = useRef<unknown>(null);
  const webrtcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webrtcLocalStreamRef = useRef<unknown>(null);
  const syncSessionInfo = useCallback(
    (snapshot: VoiceSessionDescriptor | null) => {
      if (snapshot?.id) {
        sessionIdRef.current = snapshot.id;
      }
      setSessionInfo(snapshot);
    },
    []
  );

  const refreshSessionInfo = useCallback(async () => {
    try {
      const sessions = (await resolveQuery(trpc, "voice.sessions")) as
        | VoiceSessionDescriptor[]
        | undefined
        | null;
      const snapshot = sessions && sessions.length > 0 ? sessions[0] : null;
      if (snapshot) {
        syncSessionInfo(snapshot);
      }
      return snapshot;
    } catch {
      return null;
    }
  }, [syncSessionInfo, trpc]);

  const start = useCallback(async () => {
    markVoice("fast_capture_start");
    await session.start();
  }, [session]);

  const stopAndTranscribe = useCallback(
    async (opts?: Partial<SttRequest>) => {
      try {
        const result = await session.stopAndTranscribe(opts);
        markVoice("fast_stream_flush");
        return result;
      } catch (error) {
        const clip = await captureRef.current.stop();
        if (clip) {
          await enqueue({
            kind: "stt",
            payload: {
              audioBase64: clip.audioBase64,
              mimeType: clip.mimeType,
              language: opts?.language,
              prompt: opts?.prompt,
            },
          });
        }
        throw error;
      }
    },
    [captureRef, session]
  );

  const speak = useCallback(
    async (opts: TtsRequest) => {
      try {
        await session.speak(opts);
      } catch (error) {
        await enqueue({
          kind: "tts",
          payload: {
            text: opts.text,
            voice: opts.voice,
          },
        });
        throw error;
      }
    },
    [session]
  );

  const speechToSpeechCallback = useCallback(
    async (
      overrides?: Partial<
        Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">
      >
    ) => {
      const payloadOverrides = {
        thread: overrides?.thread ?? speechDefaults.thread,
        resource: overrides?.resource ?? speechDefaults.resource,
        ttsVoice: overrides?.ttsVoice ?? speechDefaults.ttsVoice,
        ttsFormat: overrides?.ttsFormat ?? speechDefaults.ttsFormat,
        language: overrides?.language ?? speechDefaults.language,
        prompt: overrides?.prompt ?? speechDefaults.prompt,
        sttModel: overrides?.sttModel,
        ttsModel: overrides?.ttsModel,
        sessionId: sessionIdRef.current,
        surface: sessionSurface,
      };
      try {
        const result = await session.speechToSpeech?.(payloadOverrides);
        if (result?.session) {
          syncSessionInfo(result.session);
        }
        markVoice("fast_stream_flush");
        return result ?? null;
      } catch (error) {
        if (error instanceof VoiceSessionError && error.clip) {
          const queuedPayload: VoiceS2SPayload = {
            audioBase64: error.clip.audioBase64,
            mimeType: error.clip.mimeType,
            language: payloadOverrides.language,
            prompt: payloadOverrides.prompt,
            thread: payloadOverrides.thread,
            resource: payloadOverrides.resource,
            ttsVoice: payloadOverrides.ttsVoice,
            ttsFormat: payloadOverrides.ttsFormat,
            sessionId: sessionIdRef.current,
            surface: sessionSurface,
          };
          await enqueue({
            kind: "s2s",
            payload: queuedPayload,
          });
        }
        throw error;
      }
    },
    [session, sessionSurface, speechDefaults, syncSessionInfo]
  );

  const speechToSpeech =
    preferSpeechToSpeech && session.speechToSpeech
      ? speechToSpeechCallback
      : undefined;

  useEffect(() => {
    streamUrlRef.current = getVoiceStreamUrl(options?.baseUrl ?? null);
    setStreamState((prev) => ({
      ...prev,
      supported: Boolean(streamUrlRef.current) || webrtcEnabled,
    }));
  }, [options?.baseUrl]);

  useEffect(() => {
    refreshSessionInfo().catch(() => {
      // ignore
    });
  }, [refreshSessionInfo]);

  const enqueuePlayback = useCallback(async (pcmBase64: string) => {
    const wavBase64 = wrapPCM16AsWavBase64(pcmBase64);
    playbackQueueRef.current.push(wavBase64);
    if (playbackRunningRef.current) {
      return;
    }
    playbackRunningRef.current = true;
    try {
      playbackAbortRef.current?.abort();
      playbackAbortRef.current = new AbortController();
      while (playbackQueueRef.current.length > 0) {
        const clip = playbackQueueRef.current.shift();
        if (clip) {
          await playBase64(clip, "audio/wav", {
            signal: playbackAbortRef.current.signal,
          });
        }
      }
    } finally {
      playbackRunningRef.current = false;
    }
  }, []);

  const stopStreamingCapture = useCallback(async () => {
    streamingStopRef.current = true;
    streamingActiveRef.current = false;
    const recording = currentRecordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // ignore stop errors
      }
    }
    currentRecordingRef.current = null;
  }, []);

  const streamHandlers = useMemo(
    () => ({
      onSessionStarted: (event: { sessionId: string }) => {
        setStreamState((prev) => ({
          ...prev,
          status: "recording",
          sessionId: event.sessionId,
          error: null,
          transcript: "",
          assistantText: "",
          assistantRaw: null,
          uiMessages: [],
          workflow: null,
          autoStopReason: null,
        }));
        sessionIdRef.current = event.sessionId;
      },
      onPartialTranscript: (event: { text: string }) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onFinalTranscript: (event: { text: string }) => {
        setStreamState((prev) => ({
          ...prev,
          transcript: event.text,
        }));
      },
      onVadState: (event: { vadConfidence: number | null }) => {
        setStreamState((prev) => ({
          ...prev,
          vadConfidence: event.vadConfidence ?? null,
        }));
      },
      onAutoStop: (event: { reason: "manual" | "silence" | "timeout" }) => {
        setStreamState((prev) => ({
          ...prev,
          autoStopReason: event.reason,
          status: "processing",
        }));
        void stopStreamingCapture();
      },
      onAssistantMessage: (event: { text: string; raw?: unknown }) => {
        const parsed =
          event.raw === undefined ? null : parseVoiceAssistantRaw(event.raw);
        const assistantRaw = parsed?.ok ? parsed.value : null;
        const runId = assistantRaw?.meta?.runId;
        const planId = assistantRaw?.meta?.planId;
        const workflow =
          typeof runId === "string" && runId.length > 0
            ? {
                runId,
                planId: typeof planId === "string" ? planId : undefined,
              }
            : null;

        setStreamState((prev) => ({
          ...prev,
          assistantText: event.text,
          assistantRaw,
          uiMessages: assistantRaw?.uiMessages ?? [],
          workflow,
        }));
      },
      onTtsChunk: (event: { audioBase64: string }) => {
        void enqueuePlayback(event.audioBase64);
      },
      onTtsComplete: () => {
        setStreamState((prev) => ({
          ...prev,
          status: "idle",
        }));
      },
      onInterrupt: () => {
        // Clear any queued playback
        playbackQueueRef.current = [];
        playbackAbortRef.current?.abort();
        setStreamState((prev) => ({
          ...prev,
          status: "recording", // Resume listening state
        }));
      },
      onStatus: (event: { state: StreamStatus }) => {
        setStreamState((prev) => ({
          ...prev,
          status: event.state,
        }));
      },
      onError: (event: { message: string }) => {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error: event.message,
        }));
        streamingActiveRef.current = false;
      },
    }),
    [enqueuePlayback, stopStreamingCapture]
  );

  const handleRealtimeEvent = useCallback(
    (event: VoiceStreamServerEvent) => {
      switch (event._) {
        case "ready":
        case "pong": {
          return;
        }
        case "session_started": {
          logger.info("voice_webrtc_session_started", {
            sessionId: event.sessionId,
          });
          streamHandlers.onSessionStarted({ sessionId: event.sessionId });
          return;
        }
        case "partial_transcript": {
          streamHandlers.onPartialTranscript({ text: event.text });
          return;
        }
        case "final_transcript": {
          streamHandlers.onFinalTranscript({ text: event.text });
          return;
        }
        case "vad_state": {
          streamHandlers.onVadState({
            vadConfidence: event.vadConfidence ?? null,
          });
          return;
        }
        case "auto_stop": {
          streamHandlers.onAutoStop({ reason: event.reason });
          return;
        }
        case "assistant_message": {
          streamHandlers.onAssistantMessage({
            text: event.text,
            raw: event.raw,
          });
          return;
        }
        case "tts_complete": {
          streamHandlers.onTtsComplete();
          return;
        }
        case "interrupt": {
          streamHandlers.onInterrupt();
          return;
        }
        case "status": {
          streamHandlers.onStatus({ state: event.state as StreamStatus });
          return;
        }
        case "error": {
          streamHandlers.onError({ message: event.message });
          return;
        }
        // WebRTC uses RTP audio instead of `tts_chunk`.
        case "tts_chunk": {
          return;
        }
      }
    },
    [streamHandlers]
  );

  const startWebrtcStreaming = useCallback(
    async (config?: {
      sttChunkSize?: "fast" | "low" | "medium" | "accurate";
    }) => {
      const webrtc = await import("react-native-webrtc");
      const {
        RTCPeerConnection,
        RTCIceCandidate,
        RTCSessionDescription,
        mediaDevices,
      } = webrtc;

      const created = (await resolveMutation(trpc, "voice.webrtcCreate", {
        surface: sessionSurface,
      })) as { sessionId: string; iceServers: unknown };

      logger.info("voice_webrtc_create_ok", { sessionId: created.sessionId });

      sessionIdRef.current = created.sessionId;
      setStreamState((prev) => ({
        ...prev,
        status: "connecting",
        transport: "webrtc",
        sessionId: created.sessionId,
      }));

      const pc = new RTCPeerConnection({
        iceServers: parseIceServers(created.iceServers),
      });
      webrtcPcRef.current = pc;

      addEvt(pc, "iceconnectionstatechange", () => {
        try {
          logger.info("voice_webrtc_ice_state", {
            sessionId: created.sessionId,
            state: (pc as unknown as { iceConnectionState?: unknown })
              .iceConnectionState,
          });
        } catch {
          // ignore
        }
      });

      addEvt(pc, "icecandidate", (ev: unknown) => {
        if (!isRecord(ev)) {
          return;
        }
        const cand = ev.candidate as
          | { toJSON?: () => unknown }
          | null
          | undefined;
        if (!cand) {
          return;
        }
        const payload =
          typeof cand.toJSON === "function" ? cand.toJSON() : cand;
        void resolveMutation(trpc, "voice.webrtcIce", {
          sessionId: created.sessionId,
          candidate: payload,
        }).catch(() => {});
      });

      const installDc = (channel: unknown) => {
        if (!channel) {
          return;
        }
        webrtcDcRef.current = channel;
        addEvt(channel, "message", (msg: unknown) => {
          if (!isRecord(msg)) {
            return;
          }
          const { data } = msg;
          if (typeof data !== "string") {
            return;
          }
          try {
            const parsed = JSON.parse(data) as VoiceStreamServerEvent;
            if (
              parsed &&
              typeof parsed === "object" &&
              typeof parsed._ === "string"
            ) {
              handleRealtimeEvent(parsed);
            }
          } catch {
            // ignore
          }
        });
        addEvt(channel, "open", () => {
          logger.info("voice_webrtc_dc_open", { sessionId: created.sessionId });
          try {
            (channel as RnDataChannel).send(
              JSON.stringify({ _: "start", sttChunkSize: config?.sttChunkSize })
            );
          } catch {
            // ignore
          }
        });
      };

      // Offerer creates the DataChannel so the SDP includes it.
      try {
        const dc = (
          pc as unknown as { createDataChannel?: (label: string) => unknown }
        ).createDataChannel?.("voice-events");
        if (dc) {
          installDc(dc);
        }
      } catch {
        // ignore
      }

      // Back-compat: accept server-created channels (older servers/spikes).
      addEvt(pc, "datachannel", (ev: unknown) => {
        if (webrtcDcRef.current) {
          return;
        }
        if (!isRecord(ev)) {
          return;
        }
        const { channel } = ev;
        if (!channel) {
          return;
        }
        installDc(channel);
      });

      // Ensure the audio session and microphone permission are configured before
      // attempting getUserMedia. If permission prompts appear, the UI layer can
      // accept them and this will continue.
      await configureAudioSession(Audio, { background: true });
      const audioPerms = Audio as unknown as {
        requestPermissionsAsync?: () => Promise<{ status?: string }>;
      };
      if (typeof audioPerms.requestPermissionsAsync === "function") {
        const res = await audioPerms.requestPermissionsAsync();
        // Only fail fast on an explicit denial; "undetermined" may still prompt
        // and be granted by the time getUserMedia runs.
        if (res.status === "denied") {
          throw new Error("mic_permission_denied");
        }
      }

      const localStream = (await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })) as RnMediaStream;
      webrtcLocalStreamRef.current = localStream;
      for (const track of localStream.getTracks()) {
        if (track.kind === "audio") {
          track.enabled = !streamingMutedRef.current;
        }
        pc.addTrack(track, localStream);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      logger.info("voice_webrtc_offer_set_local", {
        sessionId: created.sessionId,
      });
      const answer = (await resolveMutation(trpc, "voice.webrtcOffer", {
        sessionId: created.sessionId,
        offer: { type: "offer", sdp: pc.localDescription?.sdp ?? offer.sdp },
      })) as { type: "answer"; sdp: string };
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answer.sdp })
      );
      logger.info("voice_webrtc_answer_set_remote", {
        sessionId: created.sessionId,
      });

      if (webrtcPollRef.current) {
        clearInterval(webrtcPollRef.current);
      }
      webrtcPollRef.current = setInterval(() => {
        void (async () => {
          try {
            const drained = (await resolveQuery(
              trpc,
              "voice.webrtcCandidates",
              {
                sessionId: created.sessionId,
              }
            )) as { candidates: unknown[] };
            for (const cand of drained.candidates ?? []) {
              try {
                const info = parseIceCandidateInfo(cand);
                if (info) {
                  await pc.addIceCandidate(new RTCIceCandidate(info));
                }
              } catch {
                // ignore bad candidates
              }
            }
          } catch {
            // ignore polling errors
          }
        })();
      }, WEBRTC_POLL_MS);
    },
    [handleRealtimeEvent, sessionSurface, trpc]
  );

  const stopWebrtcStreaming = useCallback(async () => {
    if (webrtcPollRef.current) {
      clearInterval(webrtcPollRef.current);
      webrtcPollRef.current = null;
    }

    const dc = webrtcDcRef.current as RnDataChannel | null;
    try {
      dc?.send(JSON.stringify({ _: "stop", reason: "manual" }));
    } catch {
      // ignore
    }
    webrtcDcRef.current = null;

    const localStream = webrtcLocalStreamRef.current as RnMediaStream | null;
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
    }
    webrtcLocalStreamRef.current = null;

    const pc = webrtcPcRef.current as RnPeerConnection | null;
    try {
      pc?.close();
    } catch {
      // ignore
    }
    webrtcPcRef.current = null;

    try {
      await resolveMutation(trpc, "voice.webrtcEnd", {
        sessionId: sessionIdRef.current,
      });
    } catch {
      // ignore
    }

    setStreamState((prev) => ({
      ...prev,
      status: "idle",
      transport: null,
      autoStopReason: null,
      error: null,
      sessionId: null,
    }));
  }, [trpc]);

  const ensureStreamClient = useCallback(() => {
    const url = streamUrlRef.current;
    if (!url) {
      throw new Error("voice_streaming_unavailable");
    }
    if (streamClientRef.current) {
      return streamClientRef.current;
    }
    const cookie = options?.getCookie?.() ?? null;
    const headers = cookie ? { Cookie: cookie } : undefined;
    const client = new VoiceStreamClient({ url, headers }, streamHandlers);
    streamClientRef.current = client;
    return client;
  }, [streamHandlers]);

  const recordChunk = useCallback(async (durationMs: number) => {
    const recording = new Audio.Recording();
    currentRecordingRef.current = recording;
    const options =
      Audio.RecordingOptionsPresets?.HIGH_QUALITY ??
      (
        Audio as unknown as {
          RecordingOptionsPresets?: { HIGH_QUALITY?: unknown };
        }
      ).RecordingOptionsPresets?.HIGH_QUALITY;
    await recording.prepareToRecordAsync(options);
    await recording.startAsync();
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
    currentRecordingRef.current = null;
    const uri = recording.getURI();
    if (!uri) {
      return null;
    }
    try {
      const audioBase64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      await deleteAsync(uri, { idempotent: true });
      return { audioBase64, mimeType: STREAM_CAPTURE_MIME };
    } catch (error) {
      await deleteAsync(uri, { idempotent: true }).catch(() => {
        // ignore
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }, []);

  const runStreamCapture = useCallback(
    async (client: VoiceStreamClient) => {
      streamingActiveRef.current = true;
      streamingStopRef.current = false;
      const startTime = Date.now();
      try {
        await configureAudioSession(Audio, { background: true });
        while (!streamingStopRef.current) {
          if (Date.now() - startTime > STREAM_TIMEOUT_MS) {
            setStreamState((prev) => ({
              ...prev,
              autoStopReason: "timeout",
            }));
            break;
          }
          const clip = await recordChunk(STREAM_CHUNK_MS);
          if (!clip || streamingStopRef.current) {
            continue;
          }
          // Skip sending audio if muted
          if (streamingMutedRef.current) {
            continue;
          }
          // Convert base64 to binary for transport
          const binary = decodeBase64ToBytes(clip.audioBase64);
          await client.sendAudioChunk({
            audio: binary,
            mimeType: clip.mimeType,
          });
        }
      } catch (error) {
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "voice_stream_capture_failed",
        }));
      } finally {
        streamingActiveRef.current = false;
        currentRecordingRef.current = null;
      }
    },
    [recordChunk]
  );

  const startStreaming = useCallback(async () => {
    if (transportRef.current) {
      return;
    }

    transportRef.current = webrtcEnabled ? "webrtc" : "ws";
    setStreamState((prev) => ({
      ...prev,
      status: "connecting",
      transport: transportRef.current,
      transcript: "",
      assistantText: "",
      autoStopReason: null,
      error: null,
    }));

    if (webrtcEnabled) {
      try {
        await startWebrtcStreaming({
          sttChunkSize: options?.sttChunkSize,
        });
        return;
      } catch (error) {
        // Fall back to WebSocket streaming (unless we're explicitly on a local
        // dev server, where we want failures to be visible and deterministic).
        const strictLocalWebrtc = (() => {
          const base = options?.baseUrl;
          if (!base) {
            return false;
          }
          try {
            const url = new URL(base);
            return url.hostname === "127.0.0.1" || url.hostname === "localhost";
          } catch {
            return false;
          }
        })();
        const errorText =
          error instanceof Error
            ? [error.message, error.stack].filter(Boolean).join("\n")
            : (typeof error === "string"
              ? error
              : "voice_webrtc_failed");
        setStreamState((prev) => ({
          ...prev,
          error: errorText,
        }));
        transportRef.current = null;
        if (strictLocalWebrtc) {
          throw error instanceof Error ? error : new Error(errorText);
        }
      }
    }

    if (!streamUrlRef.current) {
      transportRef.current = null;
      throw new Error("voice_streaming_unavailable");
    }
    setStreamState((prev) => ({
      ...prev,
      status: "connecting",
      transport: "ws",
    }));
    try {
      transportRef.current = "ws";
      const client = ensureStreamClient();
      await client.startSession({
        sessionId: sessionIdRef.current,
        surface: sessionSurface,
        codec: preferredStreamCodec,
        inputMimeType: STREAM_CAPTURE_MIME,
        sttChunkSize: options?.sttChunkSize,
      });
      void runStreamCapture(client);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "voice_stream_start_failed";
      setStreamState((prev) => ({
        ...prev,
        status: "error",
        error: prev.error ? `${prev.error}\n${msg}` : msg,
      }));
      transportRef.current = null;
      throw error;
    }
  }, [
    ensureStreamClient,
    preferredStreamCodec,
    runStreamCapture,
    sessionSurface,
    webrtcEnabled,
    startWebrtcStreaming,
  ]);

  const stopStreaming = useCallback(async () => {
    // Always stop any in-flight playback first so interruptions are deterministic.
    playbackQueueRef.current = [];
    playbackAbortRef.current?.abort();

    if (transportRef.current === "webrtc") {
      await stopWebrtcStreaming();
      transportRef.current = null;
      return;
    }

    if (!streamingActiveRef.current) {
      transportRef.current = null;
      setStreamState((prev) => ({
        ...prev,
        status: "idle",
        transport: null,
        autoStopReason: null,
        error: null,
        sessionId: null,
      }));
      return;
    }
    setStreamState((prev) => ({
      ...prev,
      status: "processing",
      autoStopReason: "manual",
    }));
    await stopStreamingCapture();
    try {
      await streamClientRef.current?.stop("manual");
      transportRef.current = null;
      setStreamState((prev) => ({
        ...prev,
        status: "idle",
        transport: null,
        autoStopReason: null,
        error: null,
        sessionId: null,
      }));
    } catch (error) {
      transportRef.current = null;
      setStreamState((prev) => ({
        ...prev,
        status: "error",
        error:
          error instanceof Error ? error.message : "voice_stream_stop_failed",
      }));
    }
  }, [stopStreamingCapture, stopWebrtcStreaming]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        return;
      }
      if (!streamingActiveRef.current) {
        return;
      }
      void stopStreaming();
    });
    return () => {
      sub.remove();
    };
  }, [stopStreaming]);

  useEffect(
    () => () => {
      void stopStreamingCapture();
      const client = streamClientRef.current;
      if (client) {
        void client.close();
      }
      void stopWebrtcStreaming();
    },
    [stopStreamingCapture, stopWebrtcStreaming]
  );

  const startFallback = () => {
    throw new Error("voice_streaming_unavailable");
  };

  const stopFallback = async () => {
    // ignore
  };

  const streamApi = {
    supported: streamState.supported,
    status: streamState.status,
    transport: streamState.transport,
    transcript: streamState.transcript,
    assistantText: streamState.assistantText,
    assistantRaw: streamState.assistantRaw,
    uiMessages: streamState.uiMessages,
    workflow: streamState.workflow,
    vadConfidence: streamState.vadConfidence,
    autoStopReason: streamState.autoStopReason,
    error: streamState.error,
    sessionId: streamState.sessionId,
    start: streamState.supported ? startStreaming : startFallback,
    stop: streamState.supported ? stopStreaming : stopFallback,
    isActive: streamState.status !== "idle" && streamState.status !== "error",
    mute: () => {
      streamingMutedRef.current = true;
      if (transportRef.current === "webrtc") {
        const local = webrtcLocalStreamRef.current as RnMediaStream | null;
        for (const track of local?.getTracks?.() ?? []) {
          if (track.kind === "audio") {
            track.enabled = false;
          }
        }
      }
    },
    unmute: () => {
      streamingMutedRef.current = false;
      if (transportRef.current === "webrtc") {
        const local = webrtcLocalStreamRef.current as RnMediaStream | null;
        for (const track of local?.getTracks?.() ?? []) {
          if (track.kind === "audio") {
            track.enabled = true;
          }
        }
      }
    },
    toggleMute: () => {
      streamingMutedRef.current = !streamingMutedRef.current;
      if (transportRef.current === "webrtc") {
        const local = webrtcLocalStreamRef.current as RnMediaStream | null;
        for (const track of local?.getTracks?.() ?? []) {
          if (track.kind === "audio") {
            track.enabled = !streamingMutedRef.current;
          }
        }
      }
      return streamingMutedRef.current;
    },
    get isMuted() {
      return streamingMutedRef.current;
    },
  };

  return {
    state: session.state,
    start,
    stopAndTranscribe,
    speak,
    speechToSpeech,
    clear: session.clear,
    stream: streamApi,
    session: sessionInfo,
    syncSession: syncSessionInfo,
    refreshSession: refreshSessionInfo,
  };
}
