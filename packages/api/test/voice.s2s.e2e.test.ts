import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { createTestDb, closeTestDb, type TestDb } from "./utils/db";
import { VoiceRegistry, VoiceSession } from "../src/voice/session";
import { STTPool } from "@alfred/voice/process/stt";
import { TTSPool } from "@alfred/voice/process/tts";
import { runAssistantForVoice } from "../src/voice/assistant";

// Mock dependencies
mock.module("@alfred/voice/process/stt", () => {
  return {
    STTPool: class MockSTTPool {
      async transcribe(req: any) {
        return {
          text: "Hello computer",
          language: "en",
          isPartial: req.streaming ? true : false,
          endOfUtterance: true
        };
      }
      size = 1;
      activeCount = 0;
      getHealth() { return [{ isHealthy: true }]; }
    }
  };
});

mock.module("@alfred/voice/process/tts", () => {
  return {
    TTSPool: class MockTTSPool {
      async synthesize(req: any, onChunk: any) {
        if (onChunk && req.streaming) {
          onChunk({ audioBase64: "chunk1", sampleRate: 24000 });
          onChunk({ audioBase64: "chunk2", sampleRate: 24000 });
        }
        return { audioBase64: "full_audio", sampleRate: 24000 };
      }
      size = 1;
      activeCount = 0;
      getHealth() { return [{ isHealthy: true }]; }
    }
  };
});

mock.module("../src/voice/assistant", () => ({
  runAssistantForVoice: mock(async () => ({
    text: "Hello human, I am functioning within normal parameters.",
    raw: {},
  })),
}));

describe("End-to-End Voice Session (S2S)", () => {
  let db: TestDb;
  let registry: VoiceRegistry;
  let sttPool: STTPool;
  let ttsPool: TTSPool;

  beforeAll(async () => {
    db = await createTestDb();
    sttPool = new STTPool({ scriptPath: "", modelPath: "" });
    ttsPool = new TTSPool({ scriptPath: "", modelPath: "" });
    registry = new VoiceRegistry(sttPool, ttsPool);
  });

  afterAll(async () => {
    await closeTestDb(db);
    registry.shutdown();
  });

  it("should handle full S2S loop: Audio -> STT -> Agent -> TTS -> Audio", async () => {
    const userId = "user_123";
    const sessionId = "session_123";
    
    const session = registry.createSession(userId, sessionId, "en");
    expect(session).toBeDefined();

    // 1. Simulate Audio Input (Client -> STT)
    // In a real stream, we'd push chunks. Here we simulate one chunk that triggers transcription.
    const sttResult = await session.processAudioChunk("base64audio", "audio/webm");
    
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
    // Note: "chunk1" in base64 might be slightly different if re-encoded or treated as buffer
    // Mock sends "chunk1" as audioBase64. session.streamSynthesis converts it to Buffer.
    // Buffer.from("chunk1", "base64") -> Buffer.
    // Then we call chunk.toString("base64"). It should match if input was valid base64.
    // "chunk1" is NOT valid base64 standard (length 6), so Buffer.from might pad it.
    // "chunkw==" is valid.
    expect(audioChunks[0]).toBe("chunkw=="); // "chunk1" interpreted as base64
    expect(audioChunks[1]).toBe("chunkw=="); // "chunk2" similarly
  });
});
