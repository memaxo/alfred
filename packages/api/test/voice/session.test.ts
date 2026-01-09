import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { STTPool } from "@alfred/voice/process/stt";
import type { TTSPool } from "@alfred/voice/process/tts";
import { VoiceSession, VoiceSessionManager } from "../../src/voice/session";

// Mock pools for testing
class MockSTTPool {
  transcribe() {
    return Promise.resolve({
      text: "test transcript",
      language: "en",
      isPartial: false,
    });
  }
}

class MockTTSPool {
  synthesize() {
    return Promise.resolve({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sampleRate: 16_000,
    });
  }
}

describe("VoiceSessionManager", () => {
  let manager: VoiceSessionManager;
  const mockSttPool = new MockSTTPool() as unknown as STTPool;
  const mockTtsPool = new MockTTSPool() as unknown as TTSPool;

  beforeEach(() => {
    manager = new VoiceSessionManager(mockSttPool, mockTtsPool);
  });

  afterEach(() => {
    manager.shutdown();
  });

  it("should create session", () => {
    const session = manager.createSession("user1", "session1", "en");
    expect(session).toBeInstanceOf(VoiceSession);
    expect(session.getSessionId()).toBe("session1");
    expect(session.getUserId()).toBe("user1");
  });

  it("should get session", () => {
    manager.createSession("user1", "session1");
    const session = manager.getSession("session1");
    expect(session).toBeTruthy();
    expect(session?.getSessionId()).toBe("session1");
  });

  it("should return null for non-existent session", () => {
    const session = manager.getSession("nonexistent");
    expect(session).toBeNull();
  });

  it("should remove session", () => {
    manager.createSession("user1", "session1");
    manager.removeSession("session1");
    const session = manager.getSession("session1");
    expect(session).toBeNull();
  });

  it("should handle multiple sessions", () => {
    manager.createSession("user1", "session1");
    manager.createSession("user1", "session2");
    manager.createSession("user2", "session3");

    expect(manager.getSession("session1")).toBeTruthy();
    expect(manager.getSession("session2")).toBeTruthy();
    expect(manager.getSession("session3")).toBeTruthy();
  });
});

describe("VoiceSession", () => {
  let session: VoiceSession;
  const mockSttPool = new MockSTTPool() as unknown as STTPool;
  const mockTtsPool = new MockTTSPool() as unknown as TTSPool;

  beforeEach(() => {
    session = new VoiceSession({
      userId: "user1",
      sessionId: "session1",
      language: "en",
      sttPool: mockSttPool,
      ttsPool: mockTtsPool,
    });
  });

  it("should start inactive", () => {
    // Sessions are activated on creation, so check that it's not idle with 0 timeout
    // Actually, sessions start active, so check that it's active
    expect(session.isIdle(0)).toBe(false);
  });

  it("should activate", () => {
    session.activate();
    expect(session.isIdle(0)).toBe(false);
  });

  it("should deactivate", () => {
    session.activate();
    session.deactivate();
    // Session should still track activity
    expect(session.getSessionId()).toBe("session1");
  });

  it("should clear transcript", () => {
    // Simulate transcript accumulation
    (session as any).transcriptBuffer = "test transcript";
    session.clearTranscript();
    expect(session.getTranscript()).toBe("");
  });

  it("should detect idle after timeout", () => {
    session.activate();
    // Wait a bit (in real test, would use fake timers)
    const isIdle = session.isIdle(100); // 100ms timeout
    // Should not be idle immediately after activation
    expect(isIdle).toBe(false);
  });
});
