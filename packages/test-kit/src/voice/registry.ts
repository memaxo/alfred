import type { STTPool } from "@alfred/voice/process/stt";
import type { TTSPool } from "@alfred/voice/process/tts";

import { VoiceRegistry } from "@alfred/voice/server/registry";
import { Buffer } from "node:buffer";

export type VoiceTestOptions = {
  transcript?: string;
  chunkText?: string;
  chunkMimeType?: string;
  streamingChunks?: number;
};

class DeterministicSTTPool {
  public readonly size = 1;
  public readonly activeCount = 0;

  constructor(private readonly transcript: string = "Test transcript") {}

  async initialize() {}
  async shutdown() {}
  releaseSession(_sessionId: string) {}

  getHealth() {
    return [{ isHealthy: true }];
  }

  async transcribe(): Promise<{
    text: string;
    language: string;
    model: string;
    durationSeconds: number;
  }> {
    return {
      text: this.transcript,
      language: "en",
      model: "test-stt",
      durationSeconds: 0.01,
    };
  }
}

class DeterministicTTSPool {
  public readonly size = 1;
  public readonly activeCount = 0;
  private readonly chunksToEmit: number;
  private readonly chunk: { audioBase64: string; mimeType: string };

  constructor(
    chunkText = "test-chunk",
    chunkMimeType = "audio/pcm",
    streamingChunks = 2
  ) {
    this.chunk = {
      audioBase64: Buffer.from(chunkText).toString("base64"),
      mimeType: chunkMimeType,
    };
    this.chunksToEmit = streamingChunks;
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
    if (request.streaming && onChunk) {
      for (let i = 0; i < this.chunksToEmit; i += 1) {
        onChunk(this.chunk);
      }
    }
    return this.chunk;
  }
}

export function createVoiceTestRegistry(options?: VoiceTestOptions) {
  const sttPool = new DeterministicSTTPool(options?.transcript);
  const ttsPool = new DeterministicTTSPool(
    options?.chunkText,
    options?.chunkMimeType,
    options?.streamingChunks
  );
  const registry = new VoiceRegistry(
    sttPool as unknown as STTPool,
    ttsPool as unknown as TTSPool
  );
  return { registry, sttPool, ttsPool };
}

export async function createVoiceFixture(options?: VoiceTestOptions) {
  const { registry, sttPool, ttsPool } = createVoiceTestRegistry(options);
  return {
    registry,
    sttPool: sttPool as unknown as STTPool,
    ttsPool: ttsPool as unknown as TTSPool,
    restore() {
      registry.shutdown();
    },
  };
}
