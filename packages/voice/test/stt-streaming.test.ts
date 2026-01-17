import { describe, expect, it, mock, beforeEach } from "bun:test";
import { STTPool, type STTRequest, type ChunkSize } from "../src/process/stt";

// Mock the entire Process module
mock.module("../src/process/base", () => {
  return {
    Process: class MockProcess {
      ipc = {
        createRequest: (type: string, payload: unknown) => ({ type, payload }),
      };
      async start() {}
      sendRequest(req: { type: string; payload: Record<string, unknown> }) {
        // Simulate cache-aware streaming response
        if (req.payload.streaming && req.payload.sessionId) {
          return {
            type: "transcript",
            payload: {
              text: "Hello, how are you?", // Punctuated output
              isPartial: true,
              streamingEnabled: true,
              model: "nvidia/nemotron-speech-streaming-en-0.6b",
            },
          };
        }
        // Non-streaming batch response
        return {
          type: "transcript",
          payload: {
            text: "test transcription",
            isPartial: false,
            streamingEnabled: false,
          },
        };
      }
      async shutdown() {}
      getHealth() {
        return { isHealthy: true };
      }
    },
  };
});

describe("STT Streaming Verification", () => {
  it("should support streaming flags in request", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    const request: STTRequest = {
      audioBase64: "test",
      mimeType: "audio/pcm",
      streaming: true,
      sessionId: "test-session",
    };

    const result = await pool.transcribe(request);
    expect(result.text).toBe("Hello, how are you?");
    expect(result.isPartial).toBe(true);
    expect(result.streamingEnabled).toBe(true);
  });

  it("should reject when the pool is saturated", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 1);
    await pool.initialize();

    const p1 = pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
    });
    const p2 = pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
    });

    const err = await p2.then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("voice_stt_pool_saturated");

    await p1;
  });
});

describe("STT Session Affinity", () => {
  it("should maintain session affinity for the same sessionId", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 2);
    await pool.initialize();

    // First request creates affinity
    await pool.transcribe({
      audioBase64: "test1",
      mimeType: "audio/pcm",
      sessionId: "session-A",
      streaming: true,
    });

    // Get session info
    const info = pool.getSessionInfo("session-A");
    expect(info.hasAffinity).toBe(true);
    expect(info.processIndex).toBeDefined();

    // Second request should use same process
    await pool.transcribe({
      audioBase64: "test2",
      mimeType: "audio/pcm",
      sessionId: "session-A",
      streaming: true,
    });

    const info2 = pool.getSessionInfo("session-A");
    expect(info2.processIndex).toBe(info.processIndex);
  });

  it("should assign different sessions to different processes (round-robin)", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 2);
    await pool.initialize();

    // First session
    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-A",
      streaming: true,
    });

    // Second session should get next process
    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-B",
      streaming: true,
    });

    const infoA = pool.getSessionInfo("session-A");
    const infoB = pool.getSessionInfo("session-B");

    expect(infoA.hasAffinity).toBe(true);
    expect(infoB.hasAffinity).toBe(true);
    // With 2 processes, they should be on different processes
    expect(infoA.processIndex).not.toBe(infoB.processIndex);
  });

  it("should release session affinity", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 1);
    await pool.initialize();

    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-A",
      streaming: true,
    });

    expect(pool.getSessionInfo("session-A").hasAffinity).toBe(true);

    pool.releaseSession("session-A");

    expect(pool.getSessionInfo("session-A").hasAffinity).toBe(false);
  });

  it("should cleanup idle sessions", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 2);
    await pool.initialize();

    // Create sessions
    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-old",
      streaming: true,
    });

    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-new",
      streaming: true,
    });

    // Both should have affinity
    expect(pool.getSessionInfo("session-old").hasAffinity).toBe(true);
    expect(pool.getSessionInfo("session-new").hasAffinity).toBe(true);

    // Cleanup with very short timeout (immediate cleanup)
    const cleaned = pool.cleanupIdleSessions(0);
    expect(cleaned).toBe(2);

    // Both should be cleaned
    expect(pool.getSessionInfo("session-old").hasAffinity).toBe(false);
    expect(pool.getSessionInfo("session-new").hasAffinity).toBe(false);
  });
});

describe("STT Chunk Size Configuration", () => {
  it("should accept chunk size in request", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    const chunkSizes: ChunkSize[] = ["fast", "low", "medium", "accurate"];

    for (const chunkSize of chunkSizes) {
      const request: STTRequest = {
        audioBase64: "test",
        mimeType: "audio/pcm",
        chunkSize,
        sessionId: `session-${chunkSize}`,
        streaming: true,
      };

      const result = await pool.transcribe(request);
      expect(result.text).toBeTruthy();
    }
  });

  it("should support clearCache flag", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    const request: STTRequest = {
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "test-session",
      streaming: true,
      clearCache: true,
    };

    const result = await pool.transcribe(request);
    expect(result.text).toBeTruthy();
  });
});

describe("STT Cache Management", () => {
  it("should clear session cache via pool method", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    // Create session
    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-to-clear",
      streaming: true,
    });

    expect(pool.getSessionInfo("session-to-clear").hasAffinity).toBe(true);

    // Clear cache
    const cleared = await pool.clearSessionCache("session-to-clear");
    // Note: In real implementation, this would communicate with Python process
    // Our mock doesn't verify the IPC call, just the local state cleanup

    expect(pool.getSessionInfo("session-to-clear").hasAffinity).toBe(false);
  });

  it("should return false when clearing non-existent session", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" });
    await pool.initialize();

    const cleared = await pool.clearSessionCache("non-existent");
    expect(cleared).toBe(false);
  });
});

describe("STT Pool Shutdown", () => {
  it("should clear all session state on shutdown", async () => {
    const pool = new STTPool({ scriptPath: "", modelPath: "" }, 2);
    await pool.initialize();

    // Create sessions
    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-1",
      streaming: true,
    });

    await pool.transcribe({
      audioBase64: "test",
      mimeType: "audio/pcm",
      sessionId: "session-2",
      streaming: true,
    });

    expect(pool.getSessionInfo("session-1").hasAffinity).toBe(true);
    expect(pool.getSessionInfo("session-2").hasAffinity).toBe(true);

    await pool.shutdown();

    // After shutdown, session maps should be cleared
    expect(pool.getSessionInfo("session-1").hasAffinity).toBe(false);
    expect(pool.getSessionInfo("session-2").hasAffinity).toBe(false);
  });
});
