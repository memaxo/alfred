import { arrayBufferToBase64, base64ToArrayBuffer } from "./converter";

export const PCM_SAMPLE_RATE = 16_000;
export const PCM_CHANNELS = 1;
export const PCM_BIT_DEPTH = 16;
export const PCM_MIME_TYPE = "audio/raw;codec=pcm_s16le;rate=16000" as const;

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/**
 * Convert PCM16 (little-endian) base64 payload into a WAV container base64 string.
 * Useful for environments (React Native) where the audio APIs expect containers.
 */
export function wrapPCM16AsWavBase64(
  pcmBase64: string,
  options?: {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
  }
): string {
  const sampleRate = options?.sampleRate ?? PCM_SAMPLE_RATE;
  const channels = options?.channels ?? PCM_CHANNELS;
  const bitDepth = options?.bitDepth ?? PCM_BIT_DEPTH;
  const pcmBuffer = base64ToArrayBuffer(pcmBase64);
  const pcmBytes = new Uint8Array(pcmBuffer);
  const headerBytes = 44;
  const totalBytes = headerBytes + pcmBytes.byteLength;
  const wavBuffer = new ArrayBuffer(totalBytes);
  const view = new DataView(wavBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (PCM)
  view.setUint16(20, 1, true); // AudioFormat PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  const byteRate = sampleRate * channels * (bitDepth / 8);
  view.setUint32(28, byteRate, true);
  const blockAlign = channels * (bitDepth / 8);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);

  new Uint8Array(wavBuffer, headerBytes).set(pcmBytes);
  return arrayBufferToBase64(wavBuffer);
}

/**
 * Convert PCM16 base64 payload to a Float32Array normalized between -1 and 1.
 * Used by web playback via Web Audio API.
 */
export function pcm16Base64ToFloat32(pcmBase64: string): Float32Array {
  const buffer = base64ToArrayBuffer(pcmBase64);
  const view = new DataView(buffer);
  const length = view.byteLength / 2;
  const result = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const sample = view.getInt16(i * 2, true);
    result[i] = sample / 0x80_00;
  }
  return result;
}
