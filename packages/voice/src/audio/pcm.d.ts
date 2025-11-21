export declare const PCM_SAMPLE_RATE = 16_000;
export declare const PCM_CHANNELS = 1;
export declare const PCM_BIT_DEPTH = 16;
/**
 * Convert PCM16 (little-endian) base64 payload into a WAV container base64 string.
 * Useful for environments (React Native) where the audio APIs expect containers.
 */
export declare function wrapPCM16AsWavBase64(
  pcmBase64: string,
  options?: {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
  }
): string;
/**
 * Convert PCM16 base64 payload to a Float32Array normalized between -1 and 1.
 * Used by web playback via Web Audio API.
 */
export declare function pcm16Base64ToFloat32(pcmBase64: string): Float32Array;
