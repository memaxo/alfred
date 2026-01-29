/**
 * Unit tests for audio resampling utilities.
 */
import { describe, expect, it } from "bun:test";

import {
  base64ToPcm16,
  calculateRms,
  getPcmDuration,
  normalizePcm,
  pcm16ToBase64,
  resample24kTo16k,
  resamplePcm,
  ttsOutputToSttInput,
} from "./audio-resample";

describe("base64ToPcm16", () => {
  it("converts base64 to Int16Array", () => {
    // Int16Array [1, 2, 3] as little-endian bytes: 01 00 02 00 03 00
    const base64 = Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03, 0x00]).toString(
      "base64"
    );
    const result = base64ToPcm16(base64);

    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
  });

  it("handles empty input", () => {
    const result = base64ToPcm16("");
    expect(result.length).toBe(0);
  });

  it("handles negative values (signed 16-bit)", () => {
    // -1 as signed 16-bit little-endian: FF FF
    const base64 = Buffer.from([0xff, 0xff]).toString("base64");
    const result = base64ToPcm16(base64);

    expect(result[0]).toBe(-1);
  });
});

describe("pcm16ToBase64", () => {
  it("converts Int16Array to base64", () => {
    const pcm = new Int16Array([1, 2, 3]);
    const result = pcm16ToBase64(pcm);

    // Convert back to verify roundtrip
    const decoded = base64ToPcm16(result);
    expect(decoded[0]).toBe(1);
    expect(decoded[1]).toBe(2);
    expect(decoded[2]).toBe(3);
  });

  it("handles empty array", () => {
    const pcm = new Int16Array([]);
    const result = pcm16ToBase64(pcm);
    expect(result).toBe("");
  });

  it("preserves negative values", () => {
    const pcm = new Int16Array([-1, -32_768, 32_767]);
    const result = pcm16ToBase64(pcm);
    const decoded = base64ToPcm16(result);

    expect(decoded[0]).toBe(-1);
    expect(decoded[1]).toBe(-32_768);
    expect(decoded[2]).toBe(32_767);
  });
});

describe("base64 roundtrip", () => {
  it("roundtrips correctly", () => {
    const original = new Int16Array([0, 100, -100, 32_767, -32_768]);
    const base64 = pcm16ToBase64(original);
    const decoded = base64ToPcm16(base64);

    expect(decoded.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBe(original[i]);
    }
  });
});

describe("resample24kTo16k", () => {
  it("downsamples by 1.5x ratio", () => {
    // 24 samples at 24kHz = 1ms
    // Should become 16 samples at 16kHz = 1ms
    const input = new Int16Array(24);
    for (let i = 0; i < 24; i++) {
      input[i] = i * 100;
    }

    const output = resample24kTo16k(input);

    // Expected length: floor(24 / 1.5) = 16
    expect(output.length).toBe(16);
  });

  it("preserves duration", () => {
    const input = new Int16Array(2400); // 100ms at 24kHz
    const output = resample24kTo16k(input);

    // 100ms at 16kHz = 1600 samples
    expect(output.length).toBe(1600);
  });

  it("handles empty input", () => {
    const input = new Int16Array(0);
    const output = resample24kTo16k(input);
    expect(output.length).toBe(0);
  });
});

describe("resamplePcm", () => {
  it("returns same array when sample rates match", () => {
    const input = new Int16Array([1, 2, 3]);
    const output = resamplePcm(input, 16_000, 16_000);

    // Should return the same array reference
    expect(output).toBe(input);
  });

  it("downsamples correctly", () => {
    // 48kHz to 16kHz = 3x downsample
    const input = new Int16Array(300); // 300 samples
    const output = resamplePcm(input, 48_000, 16_000);

    // Expected: floor(300 / 3) = 100 samples
    expect(output.length).toBe(100);
  });

  it("upsamples correctly", () => {
    // 8kHz to 16kHz = 2x upsample
    const input = new Int16Array(100);
    const output = resamplePcm(input, 8000, 16_000);

    // Expected: floor(100 / 0.5) = 200 samples
    expect(output.length).toBe(200);
  });

  it("uses linear interpolation", () => {
    // Simple test: [0, 1000] at 2x upsample should give [0, 500, 1000, ...]
    const input = new Int16Array([0, 1000]);
    const output = resamplePcm(input, 8000, 16_000);

    expect(output.length).toBe(4);
    expect(output[0]).toBe(0);
    expect(output[1]).toBe(500);
    expect(output[2]).toBe(1000);
  });
});

describe("getPcmDuration", () => {
  it("calculates duration correctly", () => {
    const pcm = new Int16Array(16_000); // 16000 samples
    const duration = getPcmDuration(pcm, 16_000);

    expect(duration).toBe(1); // 1 second
  });

  it("handles different sample rates", () => {
    const pcm = new Int16Array(48_000); // 48000 samples
    const duration = getPcmDuration(pcm, 48_000);

    expect(duration).toBe(1); // 1 second
  });

  it("handles fractional durations", () => {
    const pcm = new Int16Array(8000); // 8000 samples at 16kHz
    const duration = getPcmDuration(pcm, 16_000);

    expect(duration).toBe(0.5); // 0.5 seconds
  });

  it("returns 0 for empty array", () => {
    const pcm = new Int16Array(0);
    const duration = getPcmDuration(pcm, 16_000);

    expect(duration).toBe(0);
  });
});

describe("calculateRms", () => {
  it("returns 0 for empty array", () => {
    const pcm = new Int16Array(0);
    expect(calculateRms(pcm)).toBe(0);
  });

  it("returns 0 for silence", () => {
    const pcm = new Int16Array(100); // All zeros
    expect(calculateRms(pcm)).toBe(0);
  });

  it("calculates RMS for constant signal", () => {
    const pcm = new Int16Array(100);
    pcm.fill(100);

    // RMS of constant 100 should be 100
    expect(calculateRms(pcm)).toBe(100);
  });

  it("calculates RMS for symmetric signal", () => {
    const pcm = new Int16Array([100, -100]);

    // RMS = sqrt((100^2 + 100^2) / 2) = sqrt(10000) = 100
    expect(calculateRms(pcm)).toBe(100);
  });
});

describe("normalizePcm", () => {
  it("returns original for silent audio", () => {
    const pcm = new Int16Array(100); // All zeros
    const normalized = normalizePcm(pcm, 8000);

    // Should return same (or equivalent) array since RMS is 0
    expect(normalized.length).toBe(pcm.length);
    expect(normalized[0]).toBe(0);
  });

  it("scales up quiet audio", () => {
    const pcm = new Int16Array(100);
    pcm.fill(100); // RMS = 100

    const normalized = normalizePcm(pcm, 1000); // Target RMS = 1000

    // Scale factor = 1000 / 100 = 10
    expect(normalized[0]).toBe(1000);
  });

  it("scales down loud audio", () => {
    const pcm = new Int16Array(100);
    pcm.fill(10_000); // RMS = 10000

    const normalized = normalizePcm(pcm, 1000); // Target RMS = 1000

    // Scale factor = 1000 / 10000 = 0.1
    expect(normalized[0]).toBe(1000);
  });

  it("clamps to PCM16 bounds", () => {
    const pcm = new Int16Array(100);
    pcm.fill(30_000); // High value

    const normalized = normalizePcm(pcm, 50_000); // Would exceed max

    // Should be clamped to 32767
    expect(normalized[0]).toBeLessThanOrEqual(32_767);
    expect(normalized[0]).toBeGreaterThanOrEqual(-32_768);
  });

  it("uses default target RMS of 8000", () => {
    const pcm = new Int16Array(100);
    pcm.fill(1000); // RMS = 1000

    const normalized = normalizePcm(pcm);

    // Default target is 8000, scale = 8
    expect(normalized[0]).toBe(8000);
  });
});

describe("ttsOutputToSttInput", () => {
  it("converts and resamples TTS output", () => {
    // Create 24kHz audio (24 samples = 1ms)
    const pcm24k = new Int16Array(2400); // 100ms at 24kHz
    pcm24k.fill(1000);
    const ttsBase64 = pcm16ToBase64(pcm24k);

    const sttBase64 = ttsOutputToSttInput(ttsBase64, 24_000);

    // Decode and check
    const sttPcm = base64ToPcm16(sttBase64);

    // Should be 16kHz: 100ms = 1600 samples
    expect(sttPcm.length).toBe(1600);
  });

  it("skips resampling when already 16kHz", () => {
    const pcm16k = new Int16Array(1600); // 100ms at 16kHz
    pcm16k.fill(500);
    const input = pcm16ToBase64(pcm16k);

    const output = ttsOutputToSttInput(input, 16_000);

    const decoded = base64ToPcm16(output);
    expect(decoded.length).toBe(1600);
    expect(decoded[0]).toBe(500);
  });

  it("uses default sample rate of 24000", () => {
    const pcm = new Int16Array(2400);
    const input = pcm16ToBase64(pcm);

    const output = ttsOutputToSttInput(input); // No sample rate specified

    const decoded = base64ToPcm16(output);
    // Should resample from 24kHz to 16kHz
    expect(decoded.length).toBe(1600);
  });
});
