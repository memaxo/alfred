import type { STTPool } from "@alfred/voice/process/stt";

import { getVoicePools, initializeVoicePools } from "@alfred/api/voice/pools";
import { afterEach, beforeAll, describe, expect, it } from "bun:test";

// Increase timeout for model loading
const TIMEOUT_MS = 300_000;

const describeIntegration =
  process.env.RUN_VOICE_STT_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("STT Integration (Parakeet)", () => {
  let sttPool: STTPool;

  beforeAll(async () => {
    // Set up environment for local provider
    process.env.VOICE_PROVIDER = "maya1";
    process.env.WHISPER_MODEL_PATH = "nvidia/parakeet_realtime_eou_120m-v1";
    // Use a smaller pool for testing
    process.env.VOICE_STT_POOL_SIZE = "1";
    process.env.VOICE_TTS_POOL_SIZE = "0"; // Disable TTS for this test

    try {
      await initializeVoicePools();
      const pools = getVoicePools();
      ({ sttPool } = pools);
    } catch (error) {
      console.error("Failed to initialize voice pools:", error);
      throw error;
    }
  }, TIMEOUT_MS);

  afterEach(async () => {
    // Cleanup is handled in afterAll usually, but here we keep pool alive between tests
  });

  // Cleanup after all tests
  // Bun test doesn't export afterAll but it runs top-level code.
  // We can register cleanup via a final test or ensure clean shutdown.
  // Actually, bun test supports afterAll.

  it("should initialize the STT pool successfully", () => {
    expect(sttPool).toBeDefined();
    expect(sttPool.size).toBe(1);
    const health = sttPool.getHealth();
    expect(health[0].isHealthy).toBe(true);
  });

  it("should transcribe a simple WAV file", async () => {
    // Generate a silent wav or load a fixture
    // For this integration test, we really need a real audio file to get text output
    // or at least verify that the model runs without error on silence.

    // Create a 1-second silent WAV buffer (16kHz, mono, 16-bit)
    const sampleRate = 16_000;
    const numSamples = sampleRate * 1;
    const buffer = new Int16Array(numSamples); // Silence
    const wavHeader = createWavHeader(numSamples, sampleRate);

    // Combine header and data
    const wavBytes = new Uint8Array(wavHeader.length + buffer.byteLength);
    wavBytes.set(wavHeader, 0);
    wavBytes.set(new Uint8Array(buffer.buffer), wavHeader.length);

    const audioBase64 = Buffer.from(wavBytes).toString("base64");

    const result = await sttPool.transcribe({
      audioBase64,
      mimeType: "audio/wav",
      language: "en",
    });

    expect(result).toBeDefined();
    // Silence might result in empty text
    expect(typeof result.text).toBe("string");
    expect(result.model).toContain("parakeet");
    expect(result.provider).toBeUndefined(); // pool returns raw IPC result, router adds provider
  }, 30_000);
});

// Helper to create a minimal WAV header
function createWavHeader(numSamples: number, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.codePointAt(i));
  }
}
