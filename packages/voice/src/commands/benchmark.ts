/**
 * Voice Benchmark Command
 *
 * Benchmarks STT/TTS pipeline performance.
 */

import { logger } from "@alfred/logger";
import { Buffer } from "node:buffer";
import { join } from "node:path";

import type { ProcessConfig } from "../process/tts";

interface BenchmarkResult {
  stt: {
    avgLatencyMs: number;
    samples: number;
  };
  tts: {
    avgLatencyMs: number;
    samples: number;
    avgAudioLengthMs: number;
  };
}

/**
 * Run voice pipeline benchmark
 */
export async function benchmark(): Promise<BenchmarkResult> {
  logger.info("voice_benchmark_started");

  const results: BenchmarkResult = {
    stt: { avgLatencyMs: 0, samples: 0 },
    tts: { avgLatencyMs: 0, samples: 0, avgAudioLengthMs: 0 },
  };

  // TTS Benchmark
  logger.info("voice_benchmark_tts_started");
  try {
    const { TTSPool } = await import("../process/tts");
    const whisperModelPath =
      process.env.WHISPER_MODEL_PATH ?? "./packages/voice/models/whisper";
    const piperModelPath =
      process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";

    const root = process.cwd().endsWith("packages/voice")
      ? process.cwd()
      : join(process.cwd(), "packages/voice");

    const ttsConfig: ProcessConfig = {
      scriptPath: join(root, "python/tts"),
      modelPath: piperModelPath,
      env: {
        WHISPER_MODEL_PATH: whisperModelPath,
      },
    };

    const pool = new TTSPool(ttsConfig, 1);
    await pool.initialize();

    const testPhrases = [
      "Hello world.",
      "This is a longer test phrase to measure synthesis time.",
      "The quick brown fox jumps over the lazy dog.",
    ];

    const latencies: number[] = [];
    const audioLengthsMs: number[] = [];

    for (const phrase of testPhrases) {
      const start = performance.now();
      const chunk = await pool.synthesize({ text: phrase });
      const latency = performance.now() - start;
      latencies.push(latency);
      const bytes = Buffer.from(chunk.audioBase64, "base64").byteLength;
      const sampleRate = chunk.sampleRate ?? 16_000;
      const durationMs = (bytes / 2 / sampleRate) * 1000;
      audioLengthsMs.push(durationMs);
      logger.info("voice_benchmark_tts_sample", {
        phrase: phrase.slice(0, 80),
        latencyMs: Number(latency.toFixed(1)),
        audioBytes: bytes,
        audioDurationMs: Number(durationMs.toFixed(1)),
      });
    }

    results.tts.avgLatencyMs =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;
    results.tts.avgAudioLengthMs =
      audioLengthsMs.reduce((a, b) => a + b, 0) / audioLengthsMs.length;
    results.tts.samples = latencies.length;
    logger.info("voice_benchmark_tts_complete", {
      avgLatencyMs: Number(results.tts.avgLatencyMs.toFixed(1)),
      avgAudioLengthMs: Number(results.tts.avgAudioLengthMs.toFixed(1)),
      samples: results.tts.samples,
    });
  } catch (error) {
    logger.error("voice_benchmark_tts_failed", { error });
  }

  // STT Benchmark (would need actual audio files)
  logger.info("voice_benchmark_stt_skipped", {
    reason: "requires_audio_files",
  });

  // Summary
  const summary: Record<string, unknown> = {
    stt: results.stt,
    tts: results.tts,
  };
  logger.info("voice_benchmark_summary", summary);

  return results;
}
