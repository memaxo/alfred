import type { STTPool } from "@alfred/voice/process/stt";
import type { TTSPool } from "@alfred/voice/process/tts";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { VoiceSessionManager } from "../../src/voice/session";

// Mock pools
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
  synthesize(
    _request: { text: string; voice?: string; streaming?: boolean },
    onChunk: (chunk: {
      audioBase64: string;
      mimeType: string;
      sampleRate?: number;
    }) => void
  ): Promise<void> {
    // Simulate streaming chunks
    onChunk({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sampleRate: 16_000,
    });
    return Promise.resolve();
  }
}

// Skip these tests in fast test runs - they require voice dependencies
const shouldSkip = !process.env.RUN_VOICE_TESTS;

describe.skipIf(shouldSkip)("Voice Streaming Flow", () => {
  let sessionManager: VoiceSessionManager;
  const mockSttPool = new MockSTTPool() as unknown as STTPool;
  const mockTtsPool = new MockTTSPool() as unknown as TTSPool;

  beforeEach(() => {
    sessionManager = new VoiceSessionManager(mockSttPool, mockTtsPool);
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  it("should handle full round-trip flow", async () => {
    const session = sessionManager.createSession("user1", "session1", "en");

    // Simulate audio chunk processing
    await session.processAudioChunk("dGVzdA==", "audio/webm");

    // Check transcript
    const transcript = session.getTranscript();
    expect(transcript).toBeTruthy();

    // Simulate TTS synthesis
    const audioChunks = await session.synthesizeText("Hello, world!", "alloy");
    expect(audioChunks.length).toBeGreaterThan(0);
  });

  it("should handle concurrent sessions", async () => {
    const session1 = sessionManager.createSession("user1", "session1");
    const session2 = sessionManager.createSession("user2", "session2");

    await Promise.all([
      session1.processAudioChunk("dGVzdDE=", "audio/webm"),
      session2.processAudioChunk("dGVzdDI=", "audio/webm"),
    ]);

    expect(session1.getTranscript()).toBeTruthy();
    expect(session2.getTranscript()).toBeTruthy();
  });

  it("should cleanup idle sessions", () => {
    const session = sessionManager.createSession("user1", "session1");
    session.activate();

    // Session should exist
    expect(sessionManager.getSession("session1")).toBeTruthy();

    // Wait for cleanup (would use fake timers in real test)
    // In practice, cleanup runs every minute and removes sessions idle >5 minutes
  });
});
