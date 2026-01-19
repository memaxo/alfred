import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import {
  voiceSttDurationSeconds,
  voiceSttTotal,
  voiceTtsDurationSeconds,
  voiceTtsTotal,
} from "../metrics";
import type { STTPool } from "../process/stt";
import type { TTSPool } from "../process/tts";
import { VoiceRegistry } from "./registry";
import { VoiceSession } from "./session";

// Mock Pools
class MockSTTPool {
  transcribe(_req: any) {
    return Promise.resolve({
      text: "test transcript",
      language: "en",
      isPartial: false,
      durationSeconds: 0.12,
      model: "faster-whisper-large-v3-turbo",
    });
  }

  releaseSession(_sessionId: string) {}
}

class MockTTSPool {
  synthesize(req: any, onChunk: any) {
    if (req.streaming && onChunk) {
      onChunk({ audioBase64: "dGVzdA==", mimeType: "audio/pcm" }); // "test" in base64
    }
    return Promise.resolve({
      audioBase64: "dGVzdA==",
      mimeType: "audio/pcm",
      sampleRate: 16_000,
    });
  }
}

describe("VoiceSession (Server)", () => {
  let session: VoiceSession;
  let sttPool: any;
  let ttsPool: any;

  beforeEach(() => {
    voiceSttTotal.reset();
    voiceSttDurationSeconds.reset();
    voiceTtsTotal.reset();
    voiceTtsDurationSeconds.reset();

    sttPool = new MockSTTPool();
    ttsPool = new MockTTSPool();
    session = new VoiceSession({
      userId: "user-1",
      sessionId: "session-1",
      language: "en",
      sttPool: sttPool as STTPool,
      ttsPool: ttsPool as TTSPool,
    });
  });

  it("should process audio chunks and accumulate transcript", async () => {
    const result = await session.processAudioChunk("dGVzdA==", "audio/wav");
    expect(result?.text).toBe("test transcript");
    expect(session.getTranscript()).toBe("test transcript");

    await session.processAudioChunk("dGVzdA==", "audio/wav");
    expect(session.getTranscript()).toBe("test transcript test transcript");

    const metric = await voiceSttDurationSeconds.get();
    const count =
      metric.values.find((v) => {
        const name = v.metricName;
        return typeof name === "string" && name.endsWith("_count");
      })?.value ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it("should stream synthesis", async () => {
    let chunksReceived = 0;
    await session.streamSynthesis("Hello", "alloy", (chunk) => {
      chunksReceived++;
      expect(chunk).toBeInstanceOf(Buffer);
      expect(chunk.toString()).toBe("test"); // "dGVzdA==" decoded
    });
    expect(chunksReceived).toBe(1);

    const metric = await voiceTtsDurationSeconds.get();
    const count =
      metric.values.find((v) => {
        const name = v.metricName;
        return typeof name === "string" && name.endsWith("_count");
      })?.value ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it("should track idle state", () => {
    session.activate();
    expect(session.isIdle(1000)).toBe(false);
    // We can't easily mock Date.now() in bun:test without affecting the runtime,
    // so we rely on logic verification: isIdle checks lastActivity.
  });
});

describe("VoiceRegistry (Server)", () => {
  let manager: VoiceRegistry;
  let sttPool: any;
  let ttsPool: any;

  beforeEach(() => {
    sttPool = new MockSTTPool();
    ttsPool = new MockTTSPool();
    manager = new VoiceRegistry(sttPool, ttsPool);
  });

  afterEach(() => {
    manager.shutdown();
  });

  it("should create and retrieve sessions", () => {
    const session = manager.createSession("user-1", "session-1");
    expect(session).toBeDefined();
    expect(manager.getSession("session-1")).toBe(session);
  });

  it("should remove sessions", () => {
    manager.createSession("user-1", "session-1");
    manager.removeSession("session-1");
    expect(manager.getSession("session-1")).toBeNull();
  });
});
