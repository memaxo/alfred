/**
 * Audio resampling and PCM conversion utilities for voice pipeline tests.
 *
 * TTS (Maya1) outputs 24kHz PCM16 audio.
 * STT (Nemotron) expects 16kHz PCM16 audio.
 * These utilities handle the conversion between formats.
 */

/** PCM16 sample value bounds */
const PCM16_MIN = -32_768;
const PCM16_MAX = 32_767;

/**
 * Convert base64-encoded PCM16 audio to Int16Array.
 */
export function base64ToPcm16(base64: string): Int16Array {
  const buffer = Buffer.from(base64, "base64");
  return new Int16Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 2
  );
}

/**
 * Convert Int16Array PCM audio to base64 string.
 */
export function pcm16ToBase64(pcm: Int16Array): string {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString(
    "base64"
  );
}

/**
 * Resample PCM audio from 24kHz to 16kHz using linear interpolation.
 *
 * This is a simple resampler that works well for voice audio.
 * For production use, consider a higher-quality resampler like libsamplerate.
 */
export function resample24kTo16k(pcm24k: Int16Array): Int16Array {
  const inputSampleRate = 24_000;
  const outputSampleRate = 16_000;
  const ratio = inputSampleRate / outputSampleRate; // 1.5

  const newLength = Math.floor(pcm24k.length / ratio);
  const pcm16k = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, pcm24k.length - 1);
    const fraction = srcIndex - lower;

    const lowerVal = pcm24k[lower] ?? 0;
    const upperVal = pcm24k[upper] ?? 0;

    // Linear interpolation between samples
    pcm16k[i] = Math.round(lowerVal * (1 - fraction) + upperVal * fraction);
  }

  return pcm16k;
}

/**
 * Resample PCM audio between arbitrary sample rates using linear interpolation.
 */
export function resamplePcm(
  pcm: Int16Array,
  inputSampleRate: number,
  outputSampleRate: number
): Int16Array {
  if (inputSampleRate === outputSampleRate) {
    return pcm;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.floor(pcm.length / ratio);
  const resampled = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, pcm.length - 1);
    const fraction = srcIndex - lower;

    const lowerVal = pcm[lower] ?? 0;
    const upperVal = pcm[upper] ?? 0;

    resampled[i] = Math.round(lowerVal * (1 - fraction) + upperVal * fraction);
  }

  return resampled;
}

/**
 * Calculate the duration of PCM audio in seconds.
 */
export function getPcmDuration(pcm: Int16Array, sampleRate: number): number {
  return pcm.length / sampleRate;
}

/**
 * Calculate the RMS (Root Mean Square) level of PCM audio.
 * Useful for detecting silence or measuring audio level.
 */
export function calculateRms(pcm: Int16Array): number {
  if (pcm.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i] ?? 0;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / pcm.length);
}

/**
 * Normalize PCM audio to a target RMS level.
 */
export function normalizePcm(pcm: Int16Array, targetRms = 8000): Int16Array {
  const currentRms = calculateRms(pcm);
  if (currentRms === 0) {
    return pcm;
  }

  const scale = targetRms / currentRms;
  const normalized = new Int16Array(pcm.length);

  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i] ?? 0;
    // Clamp to prevent overflow
    normalized[i] = Math.max(
      PCM16_MIN,
      Math.min(PCM16_MAX, Math.round(sample * scale))
    );
  }

  return normalized;
}

/**
 * Convert TTS output (24kHz) to STT input format (16kHz base64).
 * This is the main utility for pipeline tests.
 */
export function ttsOutputToSttInput(
  ttsAudioBase64: string,
  ttsSampleRate = 24_000
): string {
  const pcm = base64ToPcm16(ttsAudioBase64);

  // Resample to 16kHz if needed
  const pcm16k =
    ttsSampleRate === 16_000 ? pcm : resamplePcm(pcm, ttsSampleRate, 16_000);

  return pcm16ToBase64(pcm16k);
}
