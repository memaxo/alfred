import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { createVoiceTestRegistry } from "@alfred/test-kit/voice/runtime-fixture";

function makePcmBase64(seed: string) {
  return Buffer.from(seed).toString("base64");
}

describe("VoiceSession server E2E", () => {
  let handle: ReturnType<typeof createVoiceTestRegistry>;

  beforeEach(() => {
    handle = createVoiceTestRegistry({
      transcript: "deterministic transcript",
      chunkText: "chunk-payload",
      streamingChunks: 3,
    });
  });

  afterEach(() => {
    handle.registry.shutdown();
  });

  it("captures audio, accumulates transcript, and synthesizes streaming audio", async () => {
    const session = handle.registry.createSession("user-1", "session-1", "en");
    const sttResult = await session.processAudioChunk(
      makePcmBase64("pcm-one"),
      "audio/pcm",
      { sessionId: "session-1" }
    );
    expect(sttResult?.text).toBe("deterministic transcript");

    await session.processAudioChunk(makePcmBase64("pcm-two"), "audio/pcm");
    expect(session.getTranscript()).toContain("deterministic transcript");

    const streamed: Buffer[] = [];
    await session.streamSynthesis("ack text", "maya", (chunk) => {
      streamed.push(chunk);
    });
    expect(streamed).toHaveLength(3);
    expect(streamed[0]?.length).toBeGreaterThan(0);
  });

  it("reports stats for concurrent sessions and cleans up idle entries", async () => {
    const sessionA = handle.registry.createSession("user-a", "session-a");
    const sessionB = handle.registry.createSession("user-b", "session-b");
    await sessionA.processAudioChunk(makePcmBase64("A"), "audio/pcm");
    await sessionB.processAudioChunk(makePcmBase64("B"), "audio/pcm");

    const stats = handle.registry.getStats();
    expect(stats.activeSessions).toBe(2);

    handle.registry.removeSession("session-a");
    expect(handle.registry.getStats().activeSessions).toBe(1);

    const cleared = handle.registry.clearSessions();
    expect(cleared).toBeGreaterThanOrEqual(1);
    expect(handle.registry.getStats().activeSessions).toBe(0);
  });

  it("raises errors when TTS synthesis fails mid-stream", async () => {
    const session = handle.registry.createSession("user", "tts-error");
    const original = handle.ttsPool.synthesize;
    handle.ttsPool.synthesize = () => Promise.reject(new Error("tts_failure"));

    await expect(
      session.streamSynthesis("should fail", "maya", () => {})
    ).rejects.toThrow("tts_failure");

    handle.ttsPool.synthesize = original;
  });

  it("exposes raw audio buffers for latency measurements", async () => {
    const session = handle.registry.createSession("user", "latency");
    const start = Date.now();
    const buffers = await session.synthesizeText("latency probe");
    const duration = Date.now() - start;
    expect(buffers.length).toBe(3);
    expect(duration).toBeLessThan(50);
  });
});
