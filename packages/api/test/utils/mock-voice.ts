import { mock } from "bun:test";
import { Buffer } from "node:buffer";

// Mock @discordjs/opus to avoid native binary loading
mock.module("@discordjs/opus", () => ({
  OpusEncoder: class {
    encode(_buffer: any) {
      return Buffer.from([]);
    }
    decode(_buffer: any) {
      return Buffer.from([]);
    }
  },
}));

// Mock external voice process pools to avoid native/process dependencies in tests.
mock.module("@alfred/voice/process/stt_pool", () => ({
  STTPool: class {
    start() {}
    stop() {}
    initialize() {
      return Promise.resolve();
    }
    shutdown() {
      return Promise.resolve();
    }
    transcribe() {
      return Promise.resolve({ text: "" });
    }
  },
  // Some imports reference ProcessConfig type; export a placeholder
  ProcessConfig: {} as any,
}));

mock.module("@alfred/voice/process/tts_pool", () => ({
  TTSPool: class {
    start() {}
    stop() {}
    initialize() {
      return Promise.resolve();
    }
    shutdown() {
      return Promise.resolve();
    }
    synthesize(req: any, onChunk: any) {
      if (req.streaming && onChunk) {
        // Simulate streaming chunks
        onChunk({ audioBase64: "chunk1", mimeType: "audio/pcm" });
        onChunk({ audioBase64: "chunk2", mimeType: "audio/pcm" });
        return Promise.resolve({ audioBase64: "full", mimeType: "audio/pcm" });
      }
      return Promise.resolve({ audioBase64: "full", mimeType: "audio/pcm" });
    }
  },
}));
