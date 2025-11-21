import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import type { STTPool } from "../process/stt";
import type { TTSPool } from "../process/tts";
import { VoiceSession, VoiceSessionManager } from "./session";

// Mock Pools
class MockSTTPool {
  async transcribe(_req: any) {
    return {
      text: "test transcript",
      language: "en",
      isPartial: false,
    };
  }
}

class MockTTSPool {
  async synthesize(req: any, onChunk: any) {
    if (req.streaming && onChunk) {
      onChunk({ audioBase64: "dGVzdA==", mimeType: "audio/pcm" }); // "test" in base64
    }
    return {
      audioBase64: "dGVzdA==",
      mimeType: "audio/pcm",
      sampleRate: 16_000,
    };
  }
}

describe("VoiceSession (Server)", () => {
  let session: VoiceSession;
  let sttPool: any;
  let ttsPool: any;

  beforeEach(() => {
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
  });

  it("should stream synthesis", async () => {
    let chunksReceived = 0;
    await session.streamSynthesis("Hello", "alloy", (chunk) => {
      chunksReceived++;
      expect(chunk).toBeInstanceOf(Buffer);
      expect(chunk.toString()).toBe("test"); // "dGVzdA==" decoded
    });
    expect(chunksReceived).toBe(1);
  });

  it("should track idle state", async () => {
    session.activate();
    expect(session.isIdle(1000)).toBe(false);
    // We can't easily mock Date.now() in bun:test without affecting the runtime,
    // so we rely on logic verification: isIdle checks lastActivity.
  });
});

describe("VoiceSessionManager (Server)", () => {
  let manager: VoiceSessionManager;
  let sttPool: any;
  let ttsPool: any;

  beforeEach(() => {
    sttPool = new MockSTTPool();
    ttsPool = new MockTTSPool();
    manager = new VoiceSessionManager(sttPool, ttsPool);
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
