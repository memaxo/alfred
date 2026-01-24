import { logger } from "@alfred/logger";
import { Decoder, Encoder } from "@evan/opus";
import { Buffer } from "node:buffer";
import { RTCPeerConnection, RtpHeader, RtpPacket } from "werift";

type SpikeResult = {
  ok: boolean;
  message?: string;
  audioOk?: boolean;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  getValue: () => T | null,
  opts: { timeoutMs: number; intervalMs?: number; label: string }
): Promise<T> {
  const startedAt = Date.now();
  const interval = opts.intervalMs ?? 25;
  while (Date.now() - startedAt < opts.timeoutMs) {
    const value = getValue();
    if (value !== null) {
      return value;
    }
    await sleep(interval);
  }
  throw new Error(`webrtc_spike_timeout:${opts.label}`);
}

/**
 * Minimal Bun + werift sanity check.
 *
 * Establishes a loopback PeerConnection pair in-process and verifies that:
 * - ICE candidate plumbing works under Bun
 * - SCTP/DataChannel can open and exchange a message
 *
 * This does NOT yet validate browser interop or audio/RTP ingest; those are covered
 * in later steps of the WebRTC integration plan.
 */
export async function runWebrtcSpike(): Promise<SpikeResult> {
  let pc1: RTCPeerConnection | null = null;
  let pc2: RTCPeerConnection | null = null;
  try {
    const pcA = new RTCPeerConnection();
    const pcB = new RTCPeerConnection();
    pc1 = pcA;
    pc2 = pcB;

    // ICE candidate exchange
    type IceCandidateEventLike = { candidate?: unknown };
    pcA.onicecandidate = async (event: unknown) => {
      const candidate =
        typeof event === "object" && event && "candidate" in event
          ? (event as IceCandidateEventLike).candidate
          : undefined;
      if (!candidate) {
        return;
      }
      await pcB.addIceCandidate(
        candidate as Parameters<typeof pcB.addIceCandidate>[0]
      );
    };
    pcB.onicecandidate = async (event: unknown) => {
      const candidate =
        typeof event === "object" && event && "candidate" in event
          ? (event as IceCandidateEventLike).candidate
          : undefined;
      if (!candidate) {
        return;
      }
      await pcA.addIceCandidate(
        candidate as Parameters<typeof pcA.addIceCandidate>[0]
      );
    };

    let received: string | null = null;

    type DataChannelLike = {
      onmessage?: ((msg: unknown) => void) | null;
      send?: (data: string) => void;
    };
    pcB.ondatachannel = (event: unknown) => {
      const maybe =
        typeof event === "object" && event && "channel" in event
          ? (event as { channel?: unknown }).channel
          : event;
      const chan = maybe as DataChannelLike | null;
      if (!chan) {
        return;
      }
      chan.onmessage = (msg: unknown) => {
        if (typeof msg === "string") {
          received = msg;
          return;
        }
        const data =
          typeof msg === "object" && msg && "data" in msg
            ? (msg as { data?: unknown }).data
            : undefined;
        received = typeof data === "string" ? data : "unknown";
      };
    };

    const dc1 = pcA.createDataChannel("alfred-webrtc-spike");
    dc1.onopen = () => {
      try {
        dc1.send("hello");
      } catch {
        // ignore
      }
    };

    // Add an audio transceiver so SDP negotiates Opus.
    // We'll send one synthetic Opus RTP packet after connected and verify the receiver gets it.
    pcA.addTransceiver("audio", { direction: "sendrecv" });
    pcB.addTransceiver("audio", { direction: "sendrecv" });

    let audioReceived: Buffer | null = null;
    type RtpObservableLike = {
      subscribe: (fn: (packet: unknown) => void) => void;
    };
    type TrackLike = { onReceiveRtp?: RtpObservableLike };
    pcB.ontrack = (event: unknown) => {
      const track =
        typeof event === "object" && event && "track" in event
          ? (event as { track?: unknown }).track
          : undefined;
      if (!track) {
        return;
      }
      const onReceiveRtp = (track as TrackLike).onReceiveRtp;
      if (!onReceiveRtp || typeof onReceiveRtp.subscribe !== "function") {
        return;
      }
      onReceiveRtp.subscribe((packet: unknown) => {
        const payload =
          typeof packet === "object" && packet && "payload" in packet
            ? (packet as { payload?: unknown }).payload
            : undefined;
        if (payload && Buffer.isBuffer(payload)) {
          audioReceived = payload;
        }
      });
    };

    const offer = await pcA.createOffer();
    await pcA.setLocalDescription(offer);
    await pcB.setRemoteDescription(offer);

    const answer = await pcB.createAnswer();
    await pcB.setLocalDescription(answer);
    await pcA.setRemoteDescription(answer);

    const msg = await waitFor(() => received, {
      timeoutMs: 10_000,
      label: "datachannel_message",
    });

    // Wait for ICE/DTLS to settle before attempting SRTP send.
    await waitFor(() => (pcA.connectionState === "connected" ? true : null), {
      timeoutMs: 10_000,
      label: "pc1_connected",
    });

    // Send a single 20ms silent Opus packet.
    type SenderLike = { kind?: unknown; ssrc?: unknown; sendRtp?: unknown };
    const sender = pcA.getSenders().find((s) => {
      const kind = (s as SenderLike)?.kind;
      return kind === "audio";
    });

    if (
      sender &&
      typeof (sender as SenderLike).ssrc === "number" &&
      typeof (sender as SenderLike).sendRtp === "function"
    ) {
      const enc = new Encoder({
        channels: 1,
        sample_rate: 48_000,
        application: "voip",
      });

      const frameSamples = 960; // 20ms @ 48kHz
      const pcm = Buffer.alloc(frameSamples * 2); // PCM16 mono silence
      const opus = Buffer.from(enc.encode(pcm));

      let pt = 111;
      const audioTransceiver = pcA.getTransceivers().find((t) => {
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
        const next = (getPayloadType as (codec: string) => unknown)(
          "audio/opus"
        );
        if (typeof next === "number") {
          pt = next;
        }
      }

      const ssrc = (sender as SenderLike).ssrc as number;
      const sendRtp = (sender as SenderLike).sendRtp as (
        rtp: RtpPacket
      ) => Promise<void>;
      const header = new RtpHeader({
        payloadType: pt,
        sequenceNumber: 1,
        timestamp: 0,
        ssrc,
        marker: true,
      });
      const packet = new RtpPacket(header, opus);
      await sendRtp(packet);
    }

    const audioPayload = await waitFor(() => audioReceived, {
      timeoutMs: 10_000,
      label: "audio_rtp_payload",
    });
    // Decode the received Opus payload to validate codec availability under Bun.
    const dec = new Decoder({ channels: 1, sample_rate: 48_000 });
    const decoded = Buffer.from(dec.decode(audioPayload));
    const audioOk = decoded.byteLength > 0;

    return { ok: true, message: msg, audioOk };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: msg };
  } finally {
    const closers: Promise<void>[] = [];
    if (pc1) {
      try {
        closers.push(pc1.close());
      } catch {
        // ignore
      }
    }
    if (pc2) {
      try {
        closers.push(pc2.close());
      } catch {
        // ignore
      }
    }
    if (closers.length > 0) {
      await Promise.allSettled(closers);
    }
  }
}

if (import.meta.main) {
  const result = await runWebrtcSpike();
  if (result.ok) {
    logger.info("webrtc_spike_ok", {
      message: result.message,
      audioOk: result.audioOk ?? null,
    });
  } else {
    logger.error("webrtc_spike_failed", { error: result.error });
    process.exit(1);
  }
  process.exit(0);
}
