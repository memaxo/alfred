import { performance } from "node:perf_hooks";
import { getVoicePools } from "../voice/pools";

/**
 * Voice domain service
 *
 * Extracts business logic from voice router to keep routers thin.
 * Handles health checks and roundtrip testing.
 */

type PoolHealth = {
  ok: boolean;
  workers: number;
  activeCount: number;
};

type RoundtripResult = {
  ok: boolean;
  latencyMs: number;
  originalText: string;
  transcribedText: string;
};

type VoiceHealthResult = {
  stt: PoolHealth;
  tts: PoolHealth;
  roundtrip?: RoundtripResult;
  totalLatencyMs: number;
};

/**
 * Resample PCM audio from one sample rate to another using linear interpolation.
 * Fast path: no allocations beyond result buffer.
 */
function resamplePCM(
  pcm: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) {
    return pcm;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.floor(pcm.length / ratio);
  const resampled = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, pcm.length - 1);
    const fraction = srcIndex - lower;
    const lowerVal = pcm[lower] ?? 0;
    const upperVal = pcm[upper] ?? 0;
    resampled[i] = Math.round(
      lowerVal * (1 - fraction) + upperVal * fraction
    );
  }

  return resampled;
}

/**
 * Check voice pipeline health and optionally run roundtrip test.
 */
export async function checkVoiceHealth(options?: {
  runRoundtrip?: boolean;
}): Promise<VoiceHealthResult> {
  const startTime = performance.now();
  const { sttPool, ttsPool } = getVoicePools();

  const sttHealth = sttPool.getHealth();
  const ttsHealth = ttsPool.getHealth();

  const result: VoiceHealthResult = {
    stt: {
      ok: Array.isArray(sttHealth) && sttHealth.length > 0,
      workers: Array.isArray(sttHealth) ? sttHealth.length : 0,
      activeCount: sttPool.activeCount,
    },
    tts: {
      ok: Array.isArray(ttsHealth) && ttsHealth.length > 0,
      workers: Array.isArray(ttsHealth) ? ttsHealth.length : 0,
      activeCount: ttsPool.activeCount,
    },
    totalLatencyMs: 0,
  };

  if (options?.runRoundtrip) {
    const roundtripStart = performance.now();
    const testText = "Hello";

    try {
      const ttsResult = await ttsPool.synthesize({
        text: testText,
        streaming: false,
      });

      if (!ttsResult.audioBase64) {
        throw new Error("tts_no_audio");
      }

      const ttsSampleRate = ttsResult.sampleRate ?? 24_000;
      const { decodeToPCM16 } = await import("@alfred/voice/audio/codec");

      let audioBase64 = ttsResult.audioBase64;
      const mimeType = ttsResult.mimeType ?? "audio/pcm";

      if (
        mimeType.includes("pcm") ||
        mimeType === "audio/raw" ||
        !mimeType.includes("/")
      ) {
        if (ttsSampleRate !== 16_000) {
          const buffer = Buffer.from(audioBase64, "base64");
          const pcm = new Int16Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength / 2
          );
          const resampled = resamplePCM(pcm, ttsSampleRate, 16_000);
          audioBase64 = Buffer.from(
            resampled.buffer,
            resampled.byteOffset,
            resampled.byteLength
          ).toString("base64");
        }
      } else {
        const decoded = await decodeToPCM16({
          audioBase64,
          mimeType,
        });
        audioBase64 = decoded.audioBase64;
      }

      const sttResult = await sttPool.transcribe({
        audioBase64,
        mimeType: "audio/pcm",
        streaming: false,
      });

      const roundtripLatency = performance.now() - roundtripStart;

      result.roundtrip = {
        ok: sttResult.text.length > 0,
        latencyMs: Math.round(roundtripLatency),
        originalText: testText,
        transcribedText: sttResult.text,
      };
    } catch (error) {
      result.roundtrip = {
        ok: false,
        latencyMs: Math.round(performance.now() - roundtripStart),
        originalText: testText,
        transcribedText:
          error instanceof Error ? error.message : "roundtrip_failed",
      };
    }
  }

  result.totalLatencyMs = Math.round(performance.now() - startTime);
  return result;
}
