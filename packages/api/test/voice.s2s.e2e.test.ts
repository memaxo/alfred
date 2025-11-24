import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { runAssistantForVoice } from "../src/voice/assistant";
import { VoiceRegistry } from "../src/voice/session";
import { createVoiceTestRegistry } from "@alfred/test-kit/voice/runtime-fixture";

mock.module("../src/voice/assistant", () => ({
  runAssistantForVoice: mock(async () => ({
    text: "Hello human, I am functioning within normal parameters.",
    raw: {},
  })),
}));

describe("End-to-End Voice Session (S2S)", () => {
  let registry: VoiceRegistry;

  beforeAll(async () => {
    const setup = createVoiceTestRegistry({
      transcript: "Hello computer",
      chunkText: "chunk",
    });
    registry = setup.registry;
  });

  afterAll(async () => {
    registry.shutdown();
  });

  it("should handle full S2S loop: Audio -> STT -> Agent -> TTS -> Audio", async () => {
    const userId = "user_123";
    const sessionId = "session_123";

    const session = registry.createSession(userId, sessionId, "en");
    expect(session).toBeDefined();

    // 1. Simulate Audio Input (Client -> STT)
    // In a real stream, we'd push chunks. Here we simulate one chunk that triggers transcription.
    const sttResult = await session.processAudioChunk(
      "base64audio",
      "audio/webm"
    );

    expect(sttResult).toBeDefined();
    expect(sttResult?.text).toBe("Hello computer");

    // 2. Simulate Agent Logic (usually triggered by router after EOU)
    // In the real router (speechToSpeech), it calls runAssistantForVoice.
    // Here we manually invoke the assistant simulation since we are testing the components.

    const assistantResult = await runAssistantForVoice({} as any, {
      text: sttResult!.text,
      userId,
    });

    expect(assistantResult.text).toContain("Hello human");

    // 3. Simulate TTS Output (Agent -> TTS -> Client)
    const audioChunks: string[] = [];
    await session.streamSynthesis(assistantResult.text!, "default", (chunk) => {
      audioChunks.push(chunk.toString("base64"));
    });

    expect(audioChunks.length).toBe(2);
    const expectedChunk = Buffer.from("chunk").toString("base64");
    expect(audioChunks[0]).toBe(expectedChunk);
    expect(audioChunks[1]).toBe(expectedChunk);
  });
});
