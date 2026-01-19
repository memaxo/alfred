import { beforeAll, describe, expect, it, mock } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

// Avoid real UDP/DTLS sockets in unit tests.
mock.module("werift", () => {
  class RTCDataChannel {
    onopen: (() => void) | undefined;
    send(_data: string) {}
  }

  class RTCRtpSender {
    kind = "audio";
    ssrc = 1;
    sendRtp(_packet: unknown) {
      return Promise.resolve();
    }
  }

  class MediaStreamTrack {
    kind: string;
    constructor(props: { kind: string }) {
      this.kind = props.kind;
    }
  }

  class RTCPeerConnection {
    connectionState = "new";
    localDescription: { type: "offer" | "answer"; sdp: string } | undefined;
    remoteDescription: { type: "offer" | "answer"; sdp: string } | undefined;

    onicecandidate?: (event: { candidate?: unknown }) => void;
    onconnectionstatechange?: () => void;
    ondatachannel?: (event: unknown) => void;
    ontrack?: (event: unknown) => void;

    addTransceiver() {}
    addTrack(_track: MediaStreamTrack) {
      return new RTCRtpSender();
    }
    createDataChannel(_label: string) {
      return new RTCDataChannel();
    }
    getSenders() {
      return [new RTCRtpSender()];
    }
    getTransceivers() {
      return [{ kind: "audio", getPayloadType: () => 111 }];
    }

    setRemoteDescription(desc: { type: "offer" | "answer"; sdp: string }) {
      this.remoteDescription = desc;
      return Promise.resolve();
    }

    createAnswer() {
      return Promise.resolve({ type: "answer" as const, sdp: "answer-sdp" });
    }

    setLocalDescription(desc: { type: "offer" | "answer"; sdp: string }) {
      this.localDescription = desc;
      return Promise.resolve();
    }

    addIceCandidate(_candidate: unknown) {
      return Promise.resolve();
    }

    close() {
      this.connectionState = "closed";
      return Promise.resolve();
    }
  }

  class RtpHeader {}
  class RtpPacket {}

  return {
    MediaStreamTrack,
    RTCPeerConnection,
    RTCRtpSender,
    RTCDataChannel,
    RtpHeader,
    RtpPacket,
  };
});

type Caller = Awaited<ReturnType<typeof createTestCaller>>;

describe("voice router webrtc signaling", () => {
  let caller: Caller;

  beforeAll(async () => {
    caller = await createTestCaller({ scopes: ["voice.stt", "voice.tts"] });
  });

  it("rejects unauthenticated callers", async () => {
    process.env.VOICE_WEBRTC_PROTO = "1";
    const unauth = await createUnauthedCaller();
    await expect(unauth.voice.webrtcCreate({ surface: "web" })).rejects.toThrow(
      /authentication required/i
    );
  });

  it("rejects when VOICE_WEBRTC_PROTO disabled", async () => {
    process.env.VOICE_WEBRTC_PROTO = "0";
    await expect(caller.voice.webrtcCreate({ surface: "web" })).rejects.toThrow(
      /voice_webrtc_disabled/i
    );
  });

  it("creates a session and accepts an offer", async () => {
    resetAllMocks();
    process.env.VOICE_WEBRTC_PROTO = "1";
    process.env.VOICE_ICE_SERVERS_JSON = undefined;

    const created = await caller.voice.webrtcCreate({ surface: "web" });
    expect(created.sessionId).toBeTruthy();
    expect(created.iceServers).toEqual([]);

    const answer = await caller.voice.webrtcOffer({
      sessionId: created.sessionId,
      offer: { type: "offer", sdp: "offer-sdp" },
    });
    expect(answer).toEqual({ type: "answer", sdp: "answer-sdp" });

    const candidates = await caller.voice.webrtcCandidates({
      sessionId: created.sessionId,
    });
    expect(candidates.sessionId).toBe(created.sessionId);
    expect(Array.isArray(candidates.candidates)).toBe(true);

    const end = await caller.voice.webrtcEnd({ sessionId: created.sessionId });
    expect(end).toEqual({ ok: true });
  });
});
