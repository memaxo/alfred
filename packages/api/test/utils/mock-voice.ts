import { mock, vi } from "bun:test";

// Mock external voice process pools to avoid native/process dependencies in tests.
mock.module("@alfred/voice/process/stt_pool", () => ({
  STTPool: class {
    start() {}
    stop() {}
    transcribe() { return Promise.resolve({ text: "" }); }
  },
  // Some imports reference ProcessConfig type; export a placeholder
  ProcessConfig: {} as any,
}));

mock.module("@alfred/voice/process/tts_pool", () => ({
  TTSPool: class {
    start() {}
    stop() {}
    synthesize() { return Promise.resolve(new Uint8Array()); }
  },
}));

