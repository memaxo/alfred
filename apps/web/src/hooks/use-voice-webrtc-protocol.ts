import type { UIMessage } from "@alfred/type/stream";
import type {
  VoiceAssistantRaw,
  VoiceStreamServerEvent,
} from "@alfred/type/voice";

import { parseVoiceAssistantRaw } from "@alfred/type/voice.zod";
import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserTrpcProxyClient } from "@/lib/trpc-client";

export interface VoiceWebrtcState {
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
}

function canUseWebrtc() {
  return (
    typeof RTCPeerConnection !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function useVoiceWebrtcProtocol(
  sessionIdRef: React.MutableRefObject<string>,
  handlers: { onInterrupt: () => void }
) {
  const enabled = import.meta.env.VITE_VOICE_WEBRTC === "1";
  const supported = enabled && canUseWebrtc();

  const trpcRef = useRef<ReturnType<
    typeof createBrowserTrpcProxyClient
  > | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentStartRef = useRef(false);

  const [state, setState] = useState<VoiceWebrtcState>({
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

  const stopPlayback = useCallback(() => {
    try {
      remoteAudioRef.current?.pause();
    } catch {
      // ignore
    }
  }, []);

  const ensureTrpc = useCallback(() => {
    if (!trpcRef.current) {
      trpcRef.current = createBrowserTrpcProxyClient();
    }
    return trpcRef.current;
  }, []);

  const handleServerEvent = useCallback(
    (event: VoiceStreamServerEvent) => {
      switch (event._) {
        case "ready": {
          return;
        }
        case "session_started": {
          sessionIdRef.current = event.sessionId;
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
          return;
        }
        case "partial_transcript": {
          setState((prev) => ({ ...prev, transcript: event.text }));
          return;
        }
        case "final_transcript": {
          setState((prev) => ({ ...prev, transcript: event.text }));
          return;
        }
        case "vad_state": {
          setState((prev) => ({
            ...prev,
            vadConfidence: event.vadConfidence ?? null,
          }));
          return;
        }
        case "auto_stop": {
          setState((prev) => ({
            ...prev,
            autoStopReason: event.reason,
            status: "processing",
          }));
          return;
        }
        case "assistant_message": {
          {
            const { raw } = event;
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
                ? {
                    runId,
                    planId: typeof planId === "string" ? planId : undefined,
                  }
                : null;

            setState((prev) => ({
              ...prev,
              assistantText: event.text,
              assistantRaw,
              uiMessages: assistantRaw?.uiMessages ?? [],
              workflow,
            }));
          }
          return;
        }
        case "tts_complete": {
          setState((prev) => ({ ...prev, status: "idle" }));
          return;
        }
        case "interrupt": {
          handlers.onInterrupt();
          stopPlayback();
          setState((prev) => ({ ...prev, status: "recording" }));
          return;
        }
        case "status": {
          setState((prev) => ({ ...prev, status: event.state }));
          return;
        }
        case "error": {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
          return;
        }
        // Server-side WebRTC currently does audio over RTP, not `tts_chunk`.
        case "tts_chunk":
        case "pong": {
          return;
        }
      }
    },
    [handlers, sessionIdRef, stopPlayback]
  );

  const start = useCallback(
    async (config?: {
      vadThreshold?: number;
      maxUtteranceMs?: number;
      sttChunkSize?: "fast" | "low" | "medium" | "accurate";
      autoStop?: boolean;
    }) => {
      if (!supported) {
        throw new Error("voice_webrtc_unavailable");
      }
      setState((prev) => ({ ...prev, status: "connecting", error: null }));

      const trpcClient = ensureTrpc();
      const created = await trpcClient.voice.webrtcCreate.mutate({
        surface: "web",
      });
      sessionIdRef.current = created.sessionId;
      sentStartRef.current = false;
      setState((prev) => ({ ...prev, sessionId: created.sessionId }));

      const pc = new RTCPeerConnection({
        iceServers: created.iceServers,
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: `webrtc_connection_${pc.connectionState}`,
          }));
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams?.[0];
        if (!stream) {
          return;
        }
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio("");
          remoteAudioRef.current.preload = "auto";
        }
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      };

      const installDc = (dc: RTCDataChannel) => {
        dc.onmessage = (msg) => {
          if (typeof msg.data !== "string") {
            return;
          }
          try {
            const parsed = JSON.parse(msg.data) as VoiceStreamServerEvent;
            if (
              parsed &&
              typeof parsed === "object" &&
              typeof parsed._ === "string"
            ) {
              handleServerEvent(parsed);
            }
          } catch {
            // ignore
          }
        };
      };

      // Offerer creates the DataChannel so the SDP includes it.
      const dc = pc.createDataChannel("voice-events");
      dcRef.current = dc;
      installDc(dc);

      // Back-compat: accept server-created channels (older servers/spikes).
      pc.ondatachannel = (ev) => {
        if (dcRef.current) {
          return;
        }
        dcRef.current = ev.channel;
        installDc(ev.channel);
      };

      pc.onicecandidate = (ev) => {
        const { candidate } = ev;
        if (!candidate) {
          return;
        }
        const init = candidate.toJSON();
        if (!init.candidate) {
          return;
        }
        void trpcClient.voice.webrtcIce.mutate({
          sessionId: created.sessionId,
          candidate: {
            candidate: init.candidate,
            sdpMid: init.sdpMid ?? undefined,
            sdpMLineIndex: init.sdpMLineIndex ?? undefined,
            usernameFragment: init.usernameFragment ?? undefined,
          },
        });
      };

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = localStream;
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) {
        throw new Error("webrtc_missing_local_sdp");
      }
      const answer = await trpcClient.voice.webrtcOffer.mutate({
        sessionId: created.sessionId,
        offer: { type: "offer", sdp: localSdp },
      });
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });

      // Send runtime tuning to the server once the datachannel is available.
      const sendStartConfig = () => {
        const dc = dcRef.current;
        if (!dc || dc.readyState !== "open") {
          return false;
        }
        if (sentStartRef.current) {
          return true;
        }
        dc.send(
          JSON.stringify({
            _: "start",
            vadThreshold: config?.vadThreshold,
            sttChunkSize: config?.sttChunkSize,
            maxUtteranceMs: config?.maxUtteranceMs,
            autoStop: config?.autoStop,
          })
        );
        sentStartRef.current = true;
        return true;
      };

      // Candidate polling (server -> client)
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            await sendStartConfig();
            const drained = await trpcClient.voice.webrtcCandidates.query({
              sessionId: created.sessionId,
            });
            for (const cand of drained.candidates) {
              try {
                await pc.addIceCandidate(cand);
              } catch {
                // ignore bad candidates
              }
            }
          } catch {
            // ignore poll errors
          }
        })();
      }, 200);
    },
    [ensureTrpc, handleServerEvent, sessionIdRef, supported]
  );

  const stop = useCallback(
    async (reason: "manual" | "silence" | "timeout" = "manual") => {
      stopPlayback();
      sentStartRef.current = false;

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      const dc = dcRef.current;
      try {
        dc?.send(JSON.stringify({ _: "stop", reason }));
      } catch {
        // ignore
      }
      dcRef.current = null;

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }

      const pc = pcRef.current;
      pcRef.current = null;
      try {
        pc?.close();
      } catch {
        // ignore
      }

      const sessionId = sessionIdRef.current;
      try {
        await ensureTrpc().voice.webrtcEnd.mutate({ sessionId });
      } catch {
        // ignore
      }

      setState((prev) => ({ ...prev, status: "idle", sessionId: null }));
    },
    [ensureTrpc, sessionIdRef, stopPlayback]
  );

  useEffect(
    () => () => {
      void stop("manual");
    },
    [stop]
  );

  return {
    supported,
    state,
    start,
    stop,
  };
}
