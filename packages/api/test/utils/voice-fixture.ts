import { Buffer } from "node:buffer";
import { vi } from "bun:test";
import { VoiceRegistry } from "../../src/voice/session";

export type VoiceTestOptions = {
  transcript?: string;
  chunkText?: string;
};

class TestSTTPool {
  public size = 1;
  public activeCount = 0;
  private readonly transcript: string;

  constructor(transcript: string = "Test transcript") {
    this.transcript = transcript;
  }

  async initialize() {}

  async shutdown() {}

  getHealth() {
    return [{ isHealthy: true }];
  }

  async transcribe() {
    return {
      text: this.transcript,
      language: "en",
      model: "test-stt",
      durationSeconds: 0.01,
    };
  }
}

class TestTTSPool {
  public size = 1;
  public activeCount = 0;
  private readonly chunkBase64: string;

  constructor(chunkText: string = "test-chunk") {
    this.chunkBase64 = Buffer.from(chunkText).toString("base64");
  }

  async initialize() {}

  async shutdown() {}

  getHealth() {
    return [{ isHealthy: true }];
  }

  async synthesize(
    request: { text: string; streaming?: boolean },
    onChunk?: (chunk: { audioBase64: string; mimeType: string }) => void
  ) {
    const chunk = {
      audioBase64: this.chunkBase64,
      mimeType: "audio/pcm",
    };
    if (request.streaming && onChunk) {
      onChunk(chunk);
      onChunk(chunk);
    }
    return chunk;
  }
}

export function createVoiceTestRegistry(options?: VoiceTestOptions) {
  const sttPool = new TestSTTPool(options?.transcript);
  const ttsPool = new TestTTSPool(options?.chunkText);
  const registry = new VoiceRegistry(sttPool as any, ttsPool as any);
  return { registry, sttPool, ttsPool };
}

export async function installVoiceTestPools(options?: VoiceTestOptions) {
  const poolsModule = await import("../../src/voice/pools");
  const { registry, sttPool, ttsPool } = createVoiceTestRegistry(options);

  const getVoicePoolsSpy = vi
    .spyOn(poolsModule, "getVoicePools")
    .mockReturnValue({
      sttPool,
      ttsPool,
      voiceRegistry: registry,
    });

  const initSpy = vi
    .spyOn(poolsModule, "initializeVoicePools")
    .mockResolvedValue();
  const shutdownSpy = vi
    .spyOn(poolsModule, "shutdownVoicePools")
    .mockResolvedValue();

  return {
    registry,
    sttPool,
    ttsPool,
    restore() {
      getVoicePoolsSpy.mockRestore();
      initSpy.mockRestore();
      shutdownSpy.mockRestore();
      registry.shutdown();
    },
  };
}
