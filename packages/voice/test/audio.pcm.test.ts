import { describe, expect, it } from "bun:test";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "../src/audio/converter";
import {
  PCM_BIT_DEPTH,
  PCM_CHANNELS,
  PCM_SAMPLE_RATE,
  pcm16Base64ToFloat32,
  wrapPCM16AsWavBase64,
} from "../src/audio/pcm";

describe("audio pcm helpers", () => {
  it("wraps PCM payloads in a WAV container", () => {
    const samples = new Int16Array([0, 32767, -32768, 1024]);
    const pcmBase64 = arrayBufferToBase64(samples.buffer);

    const wavBase64 = wrapPCM16AsWavBase64(pcmBase64);
    const wavBuffer = base64ToArrayBuffer(wavBase64);
    const view = new DataView(wavBuffer);

    // "RIFF"
    expect(
      String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      )
    ).toBe("RIFF");
    // "WAVE"
    expect(
      String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      )
    ).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(PCM_SAMPLE_RATE);
    expect(view.getUint16(22, true)).toBe(PCM_CHANNELS);
    expect(view.getUint16(34, true)).toBe(PCM_BIT_DEPTH);
  });

  it("converts PCM16 base64 to Float32 samples", () => {
    const samples = new Int16Array([0, 32767, -32768]);
    const pcmBase64 = arrayBufferToBase64(samples.buffer);

    const floats = pcm16Base64ToFloat32(pcmBase64);
    expect(floats).toHaveLength(samples.length);
    expect(floats[0]).toBeCloseTo(0);
    expect(floats[1]).toBeCloseTo(1, 3);
    expect(floats[2]).toBeCloseTo(-1, 3);
  });
});
