/**
 * Voice Benchmark Command
 *
 * Benchmarks STT/TTS pipeline performance.
 */

// biome-ignore lint/suspicious/noConsole: CLI output
const log = console.log;

type BenchmarkResult = {
  stt: {
    avgLatencyMs: number;
    samples: number;
  };
  tts: {
    avgLatencyMs: number;
    samples: number;
    avgAudioLengthMs: number;
  };
};

/**
 * Run voice pipeline benchmark
 */
export async function benchmark(): Promise<BenchmarkResult> {
  log("Starting voice pipeline benchmark...\n");

  const results: BenchmarkResult = {
    stt: { avgLatencyMs: 0, samples: 0 },
    tts: { avgLatencyMs: 0, samples: 0, avgAudioLengthMs: 0 },
  };

  // TTS Benchmark
  log("Testing TTS performance...");
  try {
    const { TTSPool } = await import("../process/tts");
    const pool = new TTSPool();
    await pool.initialize();

    const testPhrases = [
      "Hello world.",
      "This is a longer test phrase to measure synthesis time.",
      "The quick brown fox jumps over the lazy dog.",
    ];

    const latencies: number[] = [];

    for (const phrase of testPhrases) {
      const start = performance.now();
      await pool.synthesize(phrase);
      const latency = performance.now() - start;
      latencies.push(latency);
      log(`  "${phrase.slice(0, 30)}..." - ${latency.toFixed(1)}ms`);
    }

    results.tts.avgLatencyMs =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;
    results.tts.samples = latencies.length;
    log(`\nTTS Average: ${results.tts.avgLatencyMs.toFixed(1)}ms\n`);
  } catch (error) {
    log(`TTS benchmark failed: ${(error as Error).message}\n`);
  }

  // STT Benchmark (would need actual audio files)
  log("STT benchmark requires audio files - skipping\n");

  // Summary
  log("=== Benchmark Summary ===");
  log(
    `TTS: ${results.tts.avgLatencyMs.toFixed(1)}ms avg (${results.tts.samples} samples)`
  );
  log(
    `STT: ${results.stt.avgLatencyMs.toFixed(1)}ms avg (${results.stt.samples} samples)`
  );

  return results;
}
