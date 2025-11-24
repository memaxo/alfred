import { describe, expect, beforeEach, it } from "bun:test";
import {
  voiceSessionJitterMillis,
  voiceSessionPacketLossTotal,
  voiceSessionRttMillis,
  voiceSttDurationSeconds,
  voiceTtsDurationSeconds,
} from "@alfred/voice/metrics";
import {
  collectVoiceTelemetry,
  type VoiceTelemetrySnapshot,
} from "../src/voice/telemetry";

describe("voice telemetry summary", () => {
  beforeEach(() => {
    voiceSessionJitterMillis.reset();
    voiceSessionPacketLossTotal.reset();
    voiceSessionRttMillis.reset();
    voiceSttDurationSeconds.reset();
    voiceTtsDurationSeconds.reset();
  });

  it("returns null values when no samples exist", async () => {
    const summary = await collectVoiceTelemetry();
    expect(summary).toMatchObject<VoiceTelemetrySnapshot>({
      packetLossTotal: 0,
      sttLatency: expect.objectContaining({ count: 0, average: null }),
      ttsLatency: expect.objectContaining({ count: 0, average: null }),
      roundTrip: expect.objectContaining({ count: 0, average: null }),
      jitter: expect.objectContaining({ count: 0, average: null }),
    });
  });

  it("aggregates histogram samples across labels", async () => {
    voiceSttDurationSeconds.labels("local").observe(0.4);
    voiceSttDurationSeconds.labels("local").observe(0.6);
    voiceSttDurationSeconds.labels("cloud").observe(0.8);

    voiceSessionRttMillis.labels("session-a").observe(120);
    voiceSessionRttMillis.labels("session-b").observe(240);
    voiceSessionPacketLossTotal.inc({ session_id: "session-a" }, 2);

    const summary = await collectVoiceTelemetry();

    expect(summary.sttLatency.count).toBe(3);
    expect(summary.sttLatency.p95).toBeGreaterThan(0.5);
    expect(summary.roundTrip.average).toBeGreaterThan(0);
    expect(summary.packetLossTotal).toBe(2);
  });
});
