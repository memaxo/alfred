import { Buffer } from "node:buffer";
import { logger } from "@alfred/logger";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type {
  VoiceStreamServerEvent,
  VoiceStreamSurface,
} from "@alfred/type/voice";
import { parseVoiceAssistantRaw } from "@alfred/type/voice.zod";
import { resamplePcm16Mono } from "@alfred/voice/audio";
import {
  voiceWebrtcOfferDurationSeconds,
  voiceWebrtcRtpPacketsReceivedTotal,
  voiceWebrtcRtpPacketsSentTotal,
  voiceWebrtcSessionsClosedTotal,
  voiceWebrtcSessionsCreatedTotal,
  voiceWebrtcSessionsCurrent,
} from "@alfred/voice/metrics";
import { Decoder, Encoder } from "@evan/opus";
import {
  type RTCDataChannel,
  type RTCIceCandidateInit,
  RTCPeerConnection,
  type RTCRtpSender,
  type RTCSessionDescriptionInit,
  RtpHeader,
  RtpPacket,
} from "werift";
import { runAssistantForVoice } from "./assistant";
import { getVoicePools } from "./pools";
import {
  claimVoiceSession,
  completeVoiceSession,
  markVoiceSessionError,
  updateVoiceSession,
  type VoiceSessionStatus,
} from "./session-registry";
import { getVoiceIceServers, type VoiceIceServer } from "./webrtc";

type WebrtcSession = {
  readonly userId: string;
  readonly sessionId: string;
  readonly surface: VoiceStreamSurface;
  readonly createdAt: number;
  updatedAt: number;
  readonly pc: RTCPeerConnection;
  readonly iceOutbox: RTCIceCandidateInit[];
  eventsChannel: RTCDataChannel | null;
  readonly audioSender: RTCRtpSender;
  rtpPayloadType: number | null;
  rtpSeq: number;
  rtpTimestamp: number;
  registryId: string;
  runtime: RuntimeContext;
  vadThreshold: number;
  sttChunkSize: "fast" | "low" | "medium" | "accurate";
  autoStop: boolean;
  maxUtteranceMs: number;
  utteranceStartedAt: number | null;
  ttsInProgress: boolean;
  ttsAbort: boolean;
  sttInProgress: boolean;
  needsClearCache: boolean;
  pcm16Queue: Buffer[];
  pcm16QueuedBytes: number;
  readonly opusDecoder: Decoder;
  readonly opusEncoder: Encoder;
};

const sessions = new Map<string, WebrtcSession>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const CLEANUP_INTERVAL_MS = 15_000;
const INACTIVITY_TIMEOUT_MS = 120_000;

function ensureCleanupTimer() {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, sess] of sessions) {
      if (now - sess.updatedAt > INACTIVITY_TIMEOUT_MS) {
        void closeWebrtcSession(id, "inactivity_timeout");
      }
    }
    if (sessions.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

function toRtcIceServer(server: VoiceIceServer) {
  return {
    urls: Array.isArray(server.urls) ? (server.urls[0] ?? "") : server.urls,
    username: server.username,
    credential: server.credential,
  };
}

function createPeerConnection(): RTCPeerConnection {
  const iceServers = getVoiceIceServers();
  return new RTCPeerConnection({
    iceServers: iceServers.map(toRtcIceServer).filter((s) => Boolean(s.urls)),
  });
}

export async function createWebrtcSession(input: {
  userId: string;
  sessionId: string;
  surface: VoiceStreamSurface;
  runtime: RuntimeContext;
}): Promise<WebrtcSession> {
  ensureCleanupTimer();
  const now = Date.now();
  const pc = createPeerConnection();

  pc.addTransceiver("audio", { direction: "sendrecv" });
  type SenderLike = { kind?: unknown };
  const audioSender = pc.getSenders().find((s) => {
    const kind = (s as SenderLike)?.kind;
    return kind === "audio";
  }) as unknown as RTCRtpSender | undefined;
  if (!audioSender) {
    throw new Error("webrtc_audio_sender_missing");
  }

  const record = await claimVoiceSession({
    userId: input.userId,
    sessionId: input.sessionId,
    surface: input.surface,
    mode: "stream",
    codec: { input: "opus", output: "opus" },
  });

  const sess: WebrtcSession = {
    userId: input.userId,
    sessionId: input.sessionId,
    surface: input.surface,
    createdAt: now,
    updatedAt: now,
    pc,
    iceOutbox: [],
    eventsChannel: null,
    audioSender,
    rtpPayloadType: null,
    rtpSeq: Math.floor(Math.random() * 65_535),
    rtpTimestamp: Math.floor(Math.random() * 0xff_ff_ff_ff),
    registryId: "",
    runtime: input.runtime,
    vadThreshold: 0.5,
    sttChunkSize: "medium",
    autoStop: true,
    maxUtteranceMs: 20_000,
    utteranceStartedAt: null,
    ttsInProgress: false,
    ttsAbort: false,
    sttInProgress: false,
    needsClearCache: true,
    pcm16Queue: [],
    pcm16QueuedBytes: 0,
    opusDecoder: new Decoder({ channels: 1, sample_rate: 48_000 }),
    opusEncoder: new Encoder({
      channels: 1,
      sample_rate: 48_000,
      application: "voip",
    }),
  };
  sess.registryId = record.id;
  voiceWebrtcSessionsCurrent.inc();
  voiceWebrtcSessionsCreatedTotal.inc({ surface: input.surface });

  pc.onicecandidate = (event: { candidate?: unknown }) => {
    sess.updatedAt = Date.now();
    const candidate = event.candidate as
      | (RTCIceCandidateInit & { candidate?: string })
      | undefined;
    if (!candidate) {
      return;
    }
    if (
      typeof candidate.candidate !== "string" ||
      candidate.candidate.length === 0
    ) {
      return;
    }
    sess.iceOutbox.push({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
    });
  };

  pc.onconnectionstatechange = () => {
    sess.updatedAt = Date.now();
    const state = pc.connectionState;
    if (state === "closed") {
      void closeWebrtcSession(input.sessionId, "pc_state:closed");
      return;
    }
    if (state === "failed") {
      // Werift can briefly report "failed" before trickle ICE completes in
      // polling-based signaling. Give it a short grace window before cleanup.
      setTimeout(() => {
        const cur = sessions.get(input.sessionId);
        if (!cur) {
          return;
        }
        if (cur.pc.connectionState === "failed") {
          void closeWebrtcSession(input.sessionId, "pc_state:failed");
        }
      }, 5000).unref();
    }
  };

  type RtpObservableLike = {
    subscribe: (fn: (packet: unknown) => void) => void;
  };
  type TrackLike = { kind?: unknown; onReceiveRtp?: RtpObservableLike };
  pc.ontrack = (event: unknown) => {
    const track =
      typeof event === "object" && event && "track" in event
        ? (event as { track?: unknown }).track
        : undefined;
    if (!track) {
      return;
    }
    if ((track as TrackLike).kind !== "audio") {
      return;
    }
    const onReceiveRtp = (track as TrackLike).onReceiveRtp;
    if (!onReceiveRtp || typeof onReceiveRtp.subscribe !== "function") {
      return;
    }
    onReceiveRtp.subscribe((packet: unknown) => {
      void handleInboundRtp(sess, packet);
    });
  };

  pc.ondatachannel = (event: unknown) => {
    const ch =
      typeof event === "object" && event && "channel" in event
        ? (event as { channel?: unknown }).channel
        : event;
    if (!ch) {
      return;
    }
    const label =
      typeof ch === "object" && ch && "label" in ch
        ? (ch as { label?: unknown }).label
        : undefined;
    if (typeof label === "string" && label !== "voice-events") {
      return;
    }
    sess.eventsChannel = ch as RTCDataChannel;

    sess.eventsChannel.onopen = () => {
      sendEvent(sess, { _: "ready", sessionId: null, protocolVersion: 1 });
      sendEvent(sess, {
        _: "session_started",
        sessionId: input.sessionId,
        codec: "opus",
        negotiatedCodec: "opus",
        protocolVersion: 1,
        inputMimeType: "audio/opus",
        ttsFormat: "opus",
      });
    };

    sess.eventsChannel.onmessage = (msgEvent: unknown) => {
      const data =
        typeof msgEvent === "object" && msgEvent && "data" in msgEvent
          ? (msgEvent as { data?: unknown }).data
          : undefined;
      if (typeof data !== "string") {
        return;
      }
      try {
        const msg = JSON.parse(data) as Record<string, unknown>;
        const kind = typeof msg._ === "string" ? msg._ : null;
        if (!kind) {
          return;
        }
        if (kind === "ping") {
          sendEvent(sess, { _: "pong", sessionId: sess.sessionId });
          return;
        }
        if (kind === "start") {
          // Optional runtime tuning from the client.
          const vad = msg.vadThreshold;
          if (typeof vad === "number" && Number.isFinite(vad)) {
            sess.vadThreshold = Math.min(1, Math.max(0, vad));
          }
          const sttChunkSize = msg.sttChunkSize;
          if (
            sttChunkSize === "fast" ||
            sttChunkSize === "low" ||
            sttChunkSize === "medium" ||
            sttChunkSize === "accurate"
          ) {
            sess.sttChunkSize = sttChunkSize;
          }
          const max = msg.maxUtteranceMs;
          if (typeof max === "number" && Number.isFinite(max) && max > 0) {
            sess.maxUtteranceMs = Math.min(60_000, Math.floor(max));
          }
          const autoStop = msg.autoStop;
          if (typeof autoStop === "boolean") {
            sess.autoStop = autoStop;
          }
          sess.ttsAbort = false;
          return;
        }
        if (kind === "stop") {
          void finalizeQueuedAudio(sess);
        }
      } catch {
        // ignore
      }
    };
  };

  sessions.set(input.sessionId, sess);
  logger.info("voice_webrtc_session_created", {
    sessionId: input.sessionId,
    surface: input.surface,
  });

  return sess;
}

export function getWebrtcSession(sessionId: string): WebrtcSession | null {
  return sessions.get(sessionId) ?? null;
}

export function drainWebrtcIceCandidates(
  sessionId: string
): RTCIceCandidateInit[] {
  const sess = sessions.get(sessionId);
  if (!sess) {
    return [];
  }
  sess.updatedAt = Date.now();
  const out = sess.iceOutbox.splice(0, sess.iceOutbox.length);
  return out;
}

export async function applyWebrtcOffer(input: {
  sessionId: string;
  offer: RTCSessionDescriptionInit;
}): Promise<{ type: "answer"; sdp: string }> {
  const timerStart = performance.now();
  const sess = sessions.get(input.sessionId);
  if (!sess) {
    throw new Error("webrtc_session_missing");
  }
  sess.updatedAt = Date.now();
  await sess.pc.setRemoteDescription(input.offer as RTCSessionDescriptionInit);
  const answer = await sess.pc.createAnswer();
  await sess.pc.setLocalDescription(answer);
  let payloadType = 111;
  const audioTransceiver = sess.pc.getTransceivers().find((t) => {
    const kind = (t as { kind?: unknown }).kind;
    return kind === "audio";
  });
  const getPayloadType =
    typeof audioTransceiver === "object" &&
    audioTransceiver &&
    "getPayloadType" in audioTransceiver
      ? (audioTransceiver as { getPayloadType?: unknown }).getPayloadType
      : undefined;
  if (typeof getPayloadType === "function") {
    const next = (getPayloadType as (codec: string) => unknown)("audio/opus");
    if (typeof next === "number") {
      payloadType = next;
    }
  }
  sess.rtpPayloadType = payloadType;
  voiceWebrtcOfferDurationSeconds.observe(
    (performance.now() - timerStart) / 1000
  );
  return { type: "answer", sdp: sess.pc.localDescription?.sdp ?? answer.sdp };
}

export async function addWebrtcIceCandidate(input: {
  sessionId: string;
  candidate: RTCIceCandidateInit;
}): Promise<void> {
  const sess = sessions.get(input.sessionId);
  if (!sess) {
    throw new Error("webrtc_session_missing");
  }
  sess.updatedAt = Date.now();
  await sess.pc.addIceCandidate(input.candidate);
}

export async function closeWebrtcSession(
  sessionId: string,
  reason: string
): Promise<void> {
  const sess = sessions.get(sessionId);
  if (!sess) {
    return;
  }
  sessions.delete(sessionId);
  try {
    await sess.pc.close();
  } catch {
    // ignore
  }
  if (sess.registryId) {
    await completeVoiceSession(sess.registryId).catch(() => {});
  }
  voiceWebrtcSessionsCurrent.dec();
  voiceWebrtcSessionsClosedTotal.inc({ reason });
  logger.info("voice_webrtc_session_closed", { sessionId, reason });
}

function sendEvent(sess: WebrtcSession, event: VoiceStreamServerEvent) {
  if (!sess.eventsChannel) {
    return;
  }
  try {
    sess.eventsChannel.send(JSON.stringify(event));
  } catch {
    // ignore
  }
}

function updateStatus(sess: WebrtcSession, status: VoiceSessionStatus) {
  if (!sess.registryId) {
    return;
  }
  void updateVoiceSession(sess.registryId, { status });
}

function chunkSizeToFlushBytes(size: WebrtcSession["sttChunkSize"]) {
  const ms =
    size === "fast"
      ? 80
      : size === "low"
        ? 160
        : size === "accurate"
          ? 1120
          : 560;
  const samples = ms * 16; // 16kHz => 16 samples/ms
  return samples * 2; // PCM16
}

async function handleInboundRtp(sess: WebrtcSession, packet: unknown) {
  const p = packet as { payload?: Buffer };
  const payload = p.payload;
  if (!payload || payload.byteLength === 0) {
    return;
  }

  voiceWebrtcRtpPacketsReceivedTotal.inc();
  sess.updatedAt = Date.now();
  sess.utteranceStartedAt ??= Date.now();
  if (
    sess.autoStop &&
    sess.utteranceStartedAt &&
    Date.now() - sess.utteranceStartedAt > sess.maxUtteranceMs
  ) {
    sendEvent(sess, {
      _: "auto_stop",
      sessionId: sess.sessionId,
      reason: "timeout",
    });
    await finalizeQueuedAudio(sess);
    return;
  }
  updateStatus(sess, "recording");

  // Decode Opus -> PCM16 @ 48kHz mono
  let pcm48: Uint8Array;
  try {
    pcm48 = sess.opusDecoder.decode(payload);
  } catch (error) {
    await markVoiceSessionError(
      sess.registryId,
      error instanceof Error ? error.message : String(error)
    );
    return;
  }
  const pcm48i16 = new Int16Array(
    pcm48.buffer,
    pcm48.byteOffset,
    Math.floor(pcm48.byteLength / 2)
  );

  if (sess.ttsInProgress) {
    // Barge-in: only interrupt if we detect non-trivial input energy.
    if (avgAbsPcm16(pcm48i16) < 250) {
      return;
    }
    sess.ttsAbort = true;
    sendEvent(sess, { _: "interrupt", sessionId: sess.sessionId });
  }

  const pcm16 = resamplePcm16Mono(pcm48i16, 48_000, 16_000);
  const pcm16buf = Buffer.from(
    pcm16.buffer,
    pcm16.byteOffset,
    pcm16.byteLength
  );

  sess.pcm16Queue.push(pcm16buf);
  sess.pcm16QueuedBytes += pcm16buf.byteLength;

  const flushBytes = chunkSizeToFlushBytes(sess.sttChunkSize);
  if (sess.pcm16QueuedBytes < flushBytes) {
    return;
  }

  await flushQueuedAudio(sess);
}

function avgAbsPcm16(pcm: Int16Array): number {
  if (pcm.length === 0) {
    return 0;
  }
  let sum = 0;
  // Fast absolute value sum (clamped to avoid overflow)
  for (let i = 0; i < pcm.length; i += 1) {
    const v = pcm[i] ?? 0;
    sum += v < 0 ? -v : v;
  }
  return sum / pcm.length;
}

async function flushQueuedAudio(sess: WebrtcSession) {
  if (sess.pcm16QueuedBytes === 0) {
    return;
  }
  const chunk = Buffer.concat(sess.pcm16Queue, sess.pcm16QueuedBytes);
  sess.pcm16Queue.length = 0;
  sess.pcm16QueuedBytes = 0;

  const { voiceRegistry } = getVoicePools();
  const voiceSession =
    voiceRegistry.getSession(sess.sessionId) ??
    voiceRegistry.createSession(sess.userId, sess.sessionId);

  sess.sttInProgress = true;
  updateStatus(sess, "processing");
  try {
    const result = await voiceSession.processAudioChunk(
      chunk.toString("base64"),
      "audio/pcm",
      {
        sessionId: sess.sessionId,
        vadThreshold: sess.vadThreshold,
        chunkSize: sess.sttChunkSize,
        clearCache: sess.needsClearCache,
      }
    );
    sess.needsClearCache = false;

    const transcript = voiceSession.getTranscript();
    sendEvent(sess, {
      _: "partial_transcript",
      sessionId: sess.sessionId,
      text: transcript,
    });
    if (sess.registryId) {
      await updateVoiceSession(sess.registryId, { lastTranscript: transcript });
    }

    if (result) {
      sendEvent(sess, {
        _: "vad_state",
        sessionId: sess.sessionId,
        vadConfidence: result.vadConfidence ?? null,
        isEmpty: result.isEmpty ?? null,
        endOfUtterance: result.endOfUtterance ?? null,
      });
      if (sess.autoStop && result.endOfUtterance) {
        sendEvent(sess, {
          _: "auto_stop",
          sessionId: sess.sessionId,
          reason: "silence",
        });
        await finalizeUtterance(sess, voiceSession);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (sess.registryId) {
      await markVoiceSessionError(sess.registryId, msg);
    }
    sendEvent(sess, { _: "error", sessionId: sess.sessionId, message: msg });
  } finally {
    sess.sttInProgress = false;
  }
}

async function finalizeQueuedAudio(sess: WebrtcSession) {
  await flushQueuedAudio(sess);
  const { voiceRegistry } = getVoicePools();
  const voiceSession = voiceRegistry.getSession(sess.sessionId);
  if (voiceSession) {
    await finalizeUtterance(sess, voiceSession);
  }
}

type VoiceSessionLike = {
  getTranscript?: () => string;
  clearUtterance?: () => void;
};

async function finalizeUtterance(
  sess: WebrtcSession,
  voiceSession: VoiceSessionLike
) {
  const transcript =
    (voiceSession.getTranscript?.() as string | undefined) ?? "";
  sendEvent(sess, {
    _: "final_transcript",
    sessionId: sess.sessionId,
    text: transcript,
  });
  updateStatus(sess, "processing");

  const trimmed = transcript.trim();
  if (!trimmed) {
    updateStatus(sess, "idle");
    sess.needsClearCache = true;
    voiceSession.clearUtterance?.();
    return;
  }

  try {
    const assistant = await runAssistantForVoice(sess.runtime, {
      text: trimmed,
      userId: sess.userId,
    });
    const rawParsed = parseVoiceAssistantRaw(assistant.raw);
    if (!rawParsed.ok && assistant.raw !== undefined) {
      logger.warn("voice_assistant_raw_invalid", {
        sessionId: sess.sessionId,
        error: rawParsed.error,
      });
    }
    sendEvent(sess, {
      _: "assistant_message",
      sessionId: sess.sessionId,
      text: assistant.text,
      replayId: assistant.replayId,
      raw: rawParsed.ok ? rawParsed.value : undefined,
    });
    if (sess.registryId) {
      await updateVoiceSession(sess.registryId, {
        status: "responding",
        lastAssistantText: assistant.text,
      });
    }
    await streamTtsAsOpus(sess, assistant.text);
    sendEvent(sess, { _: "tts_complete", sessionId: sess.sessionId });
    await completeVoiceSession(sess.registryId).catch(() => {});
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (sess.registryId) {
      await markVoiceSessionError(sess.registryId, msg);
    }
    sendEvent(sess, { _: "error", sessionId: sess.sessionId, message: msg });
  } finally {
    sess.needsClearCache = true;
    sess.utteranceStartedAt = null;
    voiceSession.clearUtterance?.();
    updateStatus(sess, "idle");
  }
}

async function streamTtsAsOpus(sess: WebrtcSession, text: string) {
  if (!text.trim()) {
    return;
  }
  sess.ttsInProgress = true;
  updateStatus(sess, "responding");
  try {
    const { ttsPool } = getVoicePools();

    // Collect PCM chunks from the TTS pool; we then resample to 48k and stream
    // as Opus RTP packets in 20ms frames.
    const pcmChunks: Array<{ audio: Buffer; sampleRate: number }> = [];
    await ttsPool.synthesize(
      { text, streaming: true },
      (chunk: { audioBase64: string; sampleRate?: number }) => {
        pcmChunks.push({
          audio: Buffer.from(chunk.audioBase64, "base64"),
          sampleRate: chunk.sampleRate ?? 24_000,
        });
      }
    );

    for (const chunk of pcmChunks) {
      if (sess.ttsAbort) {
        break;
      }
      const pcmI16 = new Int16Array(
        chunk.audio.buffer,
        chunk.audio.byteOffset,
        Math.floor(chunk.audio.byteLength / 2)
      );
      const pcm48 = resamplePcm16Mono(pcmI16, chunk.sampleRate, 48_000);
      for await (const opusFrame of sess.opusEncoder.encode_pcm_stream(960, [
        pcm48,
      ])) {
        if (sess.ttsAbort) {
          break;
        }
        await sendOpusRtp(sess, Buffer.from(opusFrame));
      }
    }
  } finally {
    sess.ttsInProgress = false;
  }
}

async function sendOpusRtp(sess: WebrtcSession, opus: Buffer) {
  const pt = sess.rtpPayloadType ?? 111;
  const ssrcRaw = (sess.audioSender as unknown as { ssrc?: unknown }).ssrc;
  const ssrc = typeof ssrcRaw === "number" ? ssrcRaw : 1;
  const header = new RtpHeader({
    payloadType: pt,
    sequenceNumber: sess.rtpSeq,
    timestamp: sess.rtpTimestamp,
    ssrc,
    marker: false,
  });
  sess.rtpSeq = (sess.rtpSeq + 1) & 0xff_ff;
  sess.rtpTimestamp = (sess.rtpTimestamp + 960) >>> 0;
  const packet = new RtpPacket(header, opus);
  const sendRtp = (sess.audioSender as unknown as { sendRtp?: unknown })
    .sendRtp;
  if (typeof sendRtp !== "function") {
    throw new Error("webrtc_send_rtp_missing");
  }
  await (sendRtp as (rtp: RtpPacket) => Promise<void>)(packet);
  voiceWebrtcRtpPacketsSentTotal.inc();
}
