import { RuntimeContext } from "@alfred/type/runtime-context";
import { describe, expect, it } from "bun:test";
import { RTCPeerConnection } from "werift";

import {
  applyWebrtcOffer,
  closeWebrtcSession,
  createWebrtcSession,
  getWebrtcSession,
} from "../src/voice/webrtcsession";

const SHOULD_RUN = process.env.RUN_VOICE_WEBRTC_TESTS === "1";
const describeFn = SHOULD_RUN ? describe : describe.skip;

async function waitFor(
  cond: () => boolean,
  timeoutMs: number,
  label: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (cond()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timeout_waiting_for_${label}`);
}

describeFn("voice WebRTC integration", () => {
  it("negotiates and receives server events over DataChannel", async () => {
    const sessionId = `webrtc-${Math.random().toString(16).slice(2)}`;
    const runtime = new RuntimeContext();
    const clientPc = new RTCPeerConnection();
    clientPc.addTransceiver("audio", { direction: "sendrecv" });

    const received: unknown[] = [];
    let dcOpen = false;
    const installDc = (ch: any) => {
      ch.onopen = () => {
        dcOpen = true;
      };
      ch.onmessage = (msgEv: any) => {
        const raw = msgEv?.data;
        if (typeof raw !== "string") {
          return;
        }
        try {
          received.push(JSON.parse(raw));
        } catch {
          // ignore
        }
      };
    };

    // Offerer creates the DataChannel so SDP includes it.
    const dc = clientPc.createDataChannel("voice-events");
    installDc(dc);

    // Back-compat: accept server-created channels (older servers/spikes).
    clientPc.ondatachannel = (ev: any) => {
      const ch = ev?.channel;
      if (!ch) {
        return;
      }
      installDc(ch);
    };

    await createWebrtcSession({
      userId: "test-user",
      sessionId,
      surface: "web",
      runtime,
    });

    try {
      const offer = await clientPc.createOffer();
      await clientPc.setLocalDescription(offer);

      const answer = await applyWebrtcOffer({
        sessionId,
        offer: {
          type: "offer",
          sdp: clientPc.localDescription?.sdp ?? offer.sdp,
        },
      });

      await clientPc.setRemoteDescription({ type: "answer", sdp: answer.sdp });

      // Werift can include host candidates in SDP (non-trickle), so don't
      // require separate ICE candidate exchange here.
      await waitFor(() => dcOpen, 15_000, "datachannel_open");
      await waitFor(
        () => received.some((m: any) => m?._ === "session_started"),
        10_000,
        "session_started"
      );

      const started = received.find(
        (m: any) => m?._ === "session_started"
      ) as any;
      expect(started?.sessionId).toBe(sessionId);
      expect(started?.protocolVersion).toBe(1);
      expect(started?.codec).toBe("opus");

      // Validate that client-sent start config reaches the server session state.
      dc.send(
        JSON.stringify({
          _: "start",
          vadThreshold: 0.7,
          sttChunkSize: "fast",
          maxUtteranceMs: 1234,
          autoStop: false,
        })
      );
      await waitFor(
        () => {
          const sess = getWebrtcSession(sessionId) as any;
          return (
            Boolean(sess) &&
            sess.vadThreshold === 0.7 &&
            sess.sttChunkSize === "fast" &&
            sess.maxUtteranceMs === 1234 &&
            sess.autoStop === false
          );
        },
        5000,
        "start_config_applied"
      );
    } finally {
      await clientPc.close();
      await closeWebrtcSession(sessionId, "test_end");
    }
  }, 30_000);
});
