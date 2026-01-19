import type { Buffer } from "node:buffer";

export function pcm16ViewToInt16(view: ArrayBufferView): Int16Array {
  return new Int16Array(
    view.buffer,
    view.byteOffset,
    Math.floor(view.byteLength / 2)
  );
}

export function int16ToBuffer(view: Int16Array): Buffer {
  type BufferLike = {
    from: (
      arrayBuffer: ArrayBuffer,
      byteOffset: number,
      length: number
    ) => Buffer;
  };
  const B = (globalThis as unknown as { Buffer?: BufferLike }).Buffer;
  if (!B) {
    throw new Error("buffer_unavailable");
  }
  return B.from(view.buffer, view.byteOffset, view.byteLength) as Buffer;
}

/**
 * Resample PCM16 mono audio using linear interpolation.
 *
 * This is intentionally simple and allocation-light; it is good enough for
 * voice (narrowband-ish) and realtime constraints.
 */
export function resamplePcm16Mono(
  input: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate <= 0 || toRate <= 0) {
    throw new Error("invalid_sample_rate");
  }
  if (fromRate === toRate) {
    return input;
  }

  // Fast path: 48k -> 16k (common for Opus -> STT)
  if (fromRate === 48_000 && toRate === 16_000) {
    const outLen = Math.floor(input.length / 3);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i += 1) {
      const j = i * 3;
      const a = input[j] ?? 0;
      const b = input[j + 1] ?? a;
      const c = input[j + 2] ?? b;
      out[i] = Math.round((a + b + c) / 3);
    }
    return out;
  }

  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);

  for (let i = 0; i < outLen; i += 1) {
    const src = i * ratio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = Math.round(a * (1 - frac) + b * frac);
  }

  return out;
}
