/**
 * Synthetic Signal Generator
 * Generates valid PCM audio buffers for testing without external files.
 */
export class SyntheticSignal {
  /**
   * Generate a sine wave in 16-bit PCM (Little Endian)
   * @param hz Frequency in Hz (e.g. 440)
   * @param durationMs Duration in milliseconds
   * @param sampleRate Sample rate (default 16000)
   */
  static sine(hz: number, durationMs: number, sampleRate = 16_000): Buffer {
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const buffer = Buffer.alloc(numSamples * 2); // 2 bytes per sample

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const amplitude = Math.sin(2 * Math.PI * hz * t);
      // Convert -1.0...1.0 to -32768...32767
      const val = Math.max(-32_768, Math.min(32_767, amplitude * 32_767));
      buffer.writeInt16LE(val, i * 2);
    }

    return buffer;
  }

  static silence(durationMs: number, sampleRate = 16_000): Buffer {
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    return Buffer.alloc(numSamples * 2);
  }
}
