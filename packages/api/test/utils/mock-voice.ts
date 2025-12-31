import { mock } from "bun:test";
import { Buffer } from "node:buffer";

// Mock @discordjs/opus to avoid native binary loading

function applyMockVoice(): void {
  mock.module("@discordjs/opus", () => ({
    OpusEncoder: class {
      encode(_buffer: Uint8Array) {
        return Buffer.from([]);
      }
      decode(_buffer: Uint8Array) {
        return Buffer.from([]);
      }
    },
  }));

  // Mock external voice process pools to avoid native/process dependencies in tests.
  mock.module("@alfred/voice/process/stt", () => ({
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
    ProcessConfig: {} as Record<string, never>,
  }));

  mock.module("@alfred/voice/process/tts", () => ({
    TTSPool: class {
      start() {}
      stop() {}
      initialize() {
        return Promise.resolve();
      }
      shutdown() {
        return Promise.resolve();
      }
      synthesize(
        req: { streaming?: boolean },
        onChunk?: (chunk: { audioBase64: string; mimeType: string }) => void
      ) {
        if (req.streaming && onChunk) {
          // Simulate streaming chunks
          onChunk({ audioBase64: "chunk1", mimeType: "audio/pcm" });
          onChunk({ audioBase64: "chunk2", mimeType: "audio/pcm" });
          return Promise.resolve({
            audioBase64: "full",
            mimeType: "audio/pcm",
          });
        }
        return Promise.resolve({ audioBase64: "full", mimeType: "audio/pcm" });
      }
    },
  }));
}

applyMockVoice();

// Allow the shared test preload to re-apply baseline module mocks between tests.
(
  globalThis as unknown as {
    __alfredRegisterModuleResetter?: (fn: () => void) => void;
  }
).__alfredRegisterModuleResetter?.(applyMockVoice);
