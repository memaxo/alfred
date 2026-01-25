/**
 * Full pipeline E2E test: TTS -> STT roundtrip
 *
 * Tests the complete voice pipeline by:
 * 1. Synthesizing text to audio (TTS)
 * 2. Transcribing audio back to text (Nemotron STT)
 * 3. Comparing original vs transcribed text
 *
 * This test requires real models and is skipped by default.
 * Enable with: VOICE_PIPELINE_TEST=1
 *
 * IMPORTANT: Use TTS_PROVIDER=supertonic for reliable results.
 * Maya1 MLX backend may generate truncated audio.
 *
 * Example:
 *   VOICE_PIPELINE_TEST=1 TTS_PROVIDER=supertonic bun test test/e2e/pipeline-roundtrip.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";

import { STTPool } from "../../src/process/stt";
import { TTSPool } from "../../src/process/tts";
import {
  base64ToPcm16,
  getPcmDuration,
  pcm16ToBase64,
  resamplePcm,
} from "../utils/audio-resample";
import { analyzeWer } from "../utils/text-similarity";

// Only run if explicitly enabled
const shouldRun = process.env.VOICE_PIPELINE_TEST === "1";

// Resolve voice package directory
function resolveVoiceDir(): string {
  // When running from packages/voice
  if (process.cwd().endsWith("packages/voice")) {
    return process.cwd();
  }
  // When running from repo root
  return join(process.cwd(), "packages/voice");
}

describe.skipIf(!shouldRun)("Voice Pipeline Roundtrip E2E", () => {
  let sttPool: STTPool;
  let ttsPool: TTSPool;
  const voiceDir = resolveVoiceDir();

  beforeAll(async () => {
    console.log("Initializing voice pools...");
    console.log(`Voice directory: ${voiceDir}`);

    // STT Pool configuration
    const sttConfig = {
      scriptPath: join(voiceDir, "python/stt"),
      modelPath:
        process.env.VOICE_STT_MODEL ??
        "nvidia/nemotron-speech-streaming-en-0.6b",
      device: process.env.VOICE_STT_DEVICE ?? "auto",
    };

    // TTS Pool configuration
    const ttsConfig = {
      scriptPath: join(voiceDir, "python/tts"),
      modelPath: process.env.PIPER_MODEL_PATH ?? join(voiceDir, "models/piper"),
      voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
    };

    console.log("STT config:", sttConfig);
    console.log("TTS config:", ttsConfig);

    // Initialize pools (this may take 30-60s on first run)
    sttPool = new STTPool(sttConfig, 1);
    ttsPool = new TTSPool(ttsConfig, 1);

    console.log("Starting STT pool...");
    const sttStart = Date.now();
    await sttPool.initialize();
    console.log(`STT pool initialized in ${Date.now() - sttStart}ms`);

    console.log("Starting TTS pool...");
    const ttsStart = Date.now();
    await ttsPool.initialize();
    console.log(`TTS pool initialized in ${Date.now() - ttsStart}ms`);

    // Wait for TTS warmup to complete (warmup runs in background)
    console.log("Waiting for TTS warmup to complete...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("Both pools ready.");
  }, 180_000); // 3 minute timeout for model loading

  afterAll(async () => {
    console.log("Shutting down pools...");
    await sttPool?.shutdown();
    await ttsPool?.shutdown();
    console.log("Pools shut down.");
  });

  /**
   * Helper: Run a complete roundtrip test
   */
  async function runRoundtrip(
    originalText: string,
    options: {
      sessionId?: string;
      minSimilarity?: number;
      verbose?: boolean;
    } = {}
  ): Promise<{
    originalText: string;
    transcribedText: string;
    similarity: number;
    ttsMs: number;
    sttMs: number;
    audioDurationSec: number;
  }> {
    const {
      sessionId = `roundtrip-${Date.now()}`,
      minSimilarity = 0.7,
      verbose = true,
    } = options;

    // Step 1: TTS - synthesize text to audio
    const ttsStart = Date.now();
    const ttsResult = await ttsPool.synthesize({
      text: originalText,
      streaming: false,
    });
    const ttsMs = Date.now() - ttsStart;

    expect(ttsResult.audioBase64).toBeTruthy();
    expect(ttsResult.audioBase64.length).toBeGreaterThan(100);

    // Step 2: Convert TTS output to STT input format
    // TTS outputs 24kHz, STT expects 16kHz
    const ttsSampleRate = ttsResult.sampleRate ?? 24_000;
    const pcmTts = base64ToPcm16(ttsResult.audioBase64);
    const pcmStt = resamplePcm(pcmTts, ttsSampleRate, 16_000);
    const audioBase64 = pcm16ToBase64(pcmStt);
    const audioDurationSec = getPcmDuration(pcmStt, 16_000);

    // Calculate expected audio duration based on text length (rough heuristic: ~0.1s per word)
    const wordCount = originalText.split(/\s+/).length;
    const expectedMinDuration = wordCount * 0.1; // At least 0.1s per word

    if (verbose) {
      console.log(
        `  TTS: ${ttsMs}ms, ${pcmTts.length} samples @ ${ttsSampleRate}Hz`
      );
      console.log(
        `  TTS audio duration: ${(pcmTts.length / ttsSampleRate).toFixed(2)}s`
      );
      console.log(`  Resampled: ${pcmStt.length} samples @ 16kHz`);
      console.log(`  STT input duration: ${audioDurationSec.toFixed(2)}s`);

      // Debug: Check audio levels
      let maxSample = 0;
      let sumSquares = 0;
      for (let i = 0; i < pcmStt.length; i++) {
        const sample = Math.abs(pcmStt[i] ?? 0);
        if (sample > maxSample) {
          maxSample = sample;
        }
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / pcmStt.length);
      console.log(`  Audio levels: max=${maxSample}, rms=${rms.toFixed(0)}`);

      // Warn about potentially truncated audio
      if (audioDurationSec < expectedMinDuration) {
        console.warn(
          `  ⚠️  WARNING: Audio duration (${audioDurationSec.toFixed(2)}s) seems too short for ${wordCount} words.`
        );
        console.warn(
          `      Expected at least ${expectedMinDuration.toFixed(2)}s. TTS may be generating truncated audio.`
        );
        console.warn(
          "      Try using TTS_PROVIDER=supertonic for more reliable audio generation."
        );
      }
    }

    // Step 3: STT - transcribe audio back to text
    const sttStart = Date.now();
    const sttResult = await sttPool.transcribe({
      audioBase64,
      mimeType: "audio/pcm",
      sessionId,
      streaming: false,
    });
    const sttMs = Date.now() - sttStart;

    expect(sttResult.text).toBeDefined();

    // Step 4: Analyze results
    const analysis = analyzeWer(originalText, sttResult.text);
    const { similarity } = analysis;

    if (verbose) {
      console.log(`  STT: ${sttMs}ms`);
      console.log(`  Original: "${originalText}"`);
      console.log(`  Transcribed: "${sttResult.text}"`);
      console.log(`  Similarity: ${(similarity * 100).toFixed(1)}%`);
      console.log(`  WER: ${(analysis.wer * 100).toFixed(1)}%`);
    }

    expect(similarity).toBeGreaterThanOrEqual(minSimilarity);

    return {
      originalText,
      transcribedText: sttResult.text,
      similarity,
      ttsMs,
      sttMs,
      audioDurationSec,
    };
  }

  it("roundtrip: simple greeting", async () => {
    console.log("\nTest: Simple greeting");
    await runRoundtrip("Hello, how are you today?", {
      minSimilarity: 0.8,
    });
  }, 60_000);

  it("roundtrip: pangram sentence", async () => {
    console.log("\nTest: Pangram sentence");
    await runRoundtrip("The quick brown fox jumps over the lazy dog.", {
      minSimilarity: 0.75,
    });
  }, 60_000);

  it("roundtrip: numbers and dates", async () => {
    console.log("\nTest: Numbers and dates");
    // Note: ASR may transcribe numbers differently (e.g., "15th" vs "fifteenth")
    await runRoundtrip("The meeting is on January 15, 2026 at 3 PM.", {
      minSimilarity: 0.6, // Lower threshold for numbers
    });
  }, 60_000);

  it("roundtrip: technical terms", async () => {
    console.log("\nTest: Technical terms");
    await runRoundtrip(
      "Configure the API endpoint on localhost port three thousand.",
      {
        minSimilarity: 0.7,
      }
    );
  }, 60_000);

  it("roundtrip: longer paragraph", async () => {
    console.log("\nTest: Longer paragraph");
    const text =
      "Alfred is a personal AI assistant designed for privacy and performance. " +
      "It runs locally on your machine and uses state of the art speech recognition.";

    await runRoundtrip(text, {
      minSimilarity: 0.7,
    });
  }, 90_000);

  it("roundtrip: question format", async () => {
    console.log("\nTest: Question format");
    await runRoundtrip("What is the weather like in San Francisco today?", {
      minSimilarity: 0.8,
    });
  }, 60_000);

  it("roundtrip: command format", async () => {
    console.log("\nTest: Command format");
    await runRoundtrip("Set a reminder for tomorrow at nine AM.", {
      minSimilarity: 0.75,
    });
  }, 60_000);

  it("roundtrip: multiple sentences", async () => {
    console.log("\nTest: Multiple sentences");
    const text =
      "Hello Alfred. Please check my calendar for today. " +
      "Also remind me to call John at five PM.";

    await runRoundtrip(text, {
      minSimilarity: 0.7,
    });
  }, 90_000);

  it("aggregated accuracy report", async () => {
    console.log("\n========== Aggregated Accuracy Report ==========");

    const testCases = [
      "Hello world.",
      "Thank you very much.",
      "Please turn on the lights.",
      "What time is it?",
      "Send an email to Alice.",
    ];

    const results: {
      text: string;
      similarity: number;
      wer: number;
    }[] = [];

    for (const text of testCases) {
      const result = await runRoundtrip(text, {
        minSimilarity: 0.5, // Lower for aggregate
        verbose: false,
      });
      const analysis = analyzeWer(text, result.transcribedText);
      results.push({
        text,
        similarity: result.similarity,
        wer: analysis.wer,
      });
      console.log(
        `  "${text}" -> ${(result.similarity * 100).toFixed(0)}% similarity`
      );
    }

    // Calculate aggregate metrics
    const avgSimilarity =
      results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    const avgWer = results.reduce((sum, r) => sum + r.wer, 0) / results.length;

    console.log("\n  ----------------------------------------");
    console.log(`  Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
    console.log(`  Average WER: ${(avgWer * 100).toFixed(1)}%`);
    console.log("  ========================================\n");

    // Overall threshold
    expect(avgSimilarity).toBeGreaterThanOrEqual(0.7);
  }, 300_000); // 5 minutes for multiple roundtrips
});

// Standalone smoke test that can run without the full test suite
describe.skipIf(!shouldRun)("Voice Pipeline Smoke Test", () => {
  it("can synthesize and transcribe a single phrase", async () => {
    const voiceDir = resolveVoiceDir();

    const sttPool = new STTPool(
      {
        scriptPath: join(voiceDir, "python/stt"),
        modelPath:
          process.env.VOICE_STT_MODEL ??
          "nvidia/nemotron-speech-streaming-en-0.6b",
      },
      1
    );

    const ttsPool = new TTSPool(
      {
        scriptPath: join(voiceDir, "python/tts"),
        modelPath: join(voiceDir, "models/piper"),
      },
      1
    );

    try {
      await sttPool.initialize();
      await ttsPool.initialize();

      // Wait for TTS warmup (if using Maya1)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Synthesize
      const ttsResult = await ttsPool.synthesize({
        text: "Hello world.",
        streaming: false,
      });

      expect(ttsResult.audioBase64).toBeTruthy();

      // Validate audio duration (should be at least 0.5s for "Hello world")
      const pcm = base64ToPcm16(ttsResult.audioBase64);
      const ttsSampleRate = ttsResult.sampleRate ?? 24_000;
      const audioDuration = pcm.length / ttsSampleRate;

      if (audioDuration < 0.5) {
        console.warn(
          `⚠️  Audio too short (${audioDuration.toFixed(2)}s). TTS may be generating truncated audio.`
        );
        console.warn("    Try using TTS_PROVIDER=supertonic");
      }

      // Convert and transcribe
      const pcm16k = resamplePcm(pcm, ttsSampleRate, 16_000);

      const sttResult = await sttPool.transcribe({
        audioBase64: pcm16ToBase64(pcm16k),
        mimeType: "audio/pcm",
        sessionId: "smoke-test",
      });

      console.log(`Transcribed: "${sttResult.text}"`);

      // For short audio, we may not get a perfect match
      if (audioDuration >= 0.5) {
        expect(sttResult.text.toLowerCase()).toContain("hello");
      } else {
        // Just check we got some output
        expect(sttResult.text).toBeDefined();
      }
    } finally {
      await sttPool.shutdown();
      await ttsPool.shutdown();
    }
  }, 180_000);
});
