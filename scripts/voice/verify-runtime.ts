#!/usr/bin/env bun

/**
 * Voice Runtime Verification Script (Level 4)
 *
 * Verifies the entire audio I/O pipeline with real binaries:
 * 1. TTS: Synthesize text to PCM (uses real piper/python)
 * 2. Codec: Transcode PCM to WAV (uses real ffmpeg)
 * 3. STT: Transcribe audio back to text (uses real faster-whisper/python)
 * 4. Assertions: Verify latency and text accuracy (fuzzy match)
 *
 * Usage:
 *   bun run scripts/verify-voice-runtime.ts
 *
 * Environment variables:
 *   VOICE_PROVIDER=maya1 (required)
 *   PIPER_MODEL_PATH
 *   WHISPER_MODEL_PATH
 *   STRICT_LATENCY=1 (optional, fails on latency violations)
 */

import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../packages/api/src/voice/pools";
import { encodeFromPCM16 } from "../packages/voice/src/audio/codec";

// Configuration
const TEST_PHRASE = "The quick brown fox jumps over the lazy dog.";
// Allow some fuzzy matching (Levenshtein distance could be used, but simple inclusion is often enough for smoke tests)
// Whisper large-v3 is very accurate, but "The" vs "the" or punctuation might vary.
const EXPECTED_KEYWORDS = ["quick", "brown", "fox", "jumps", "lazy", "dog"];

const LATENCY_THRESHOLDS = {
  tts_p95: 1000, // 1s for synthesis start
  stt_p95: 2000, // 2s for transcription
};

async function main() {
  console.log("🎤 ALFRED Voice Runtime Verification (Level 4)\n");

  // Check environment
  const voiceProvider = process.env.VOICE_PROVIDER ?? "maya1";
  if (voiceProvider !== "maya1") {
    console.error("❌ VOICE_PROVIDER must be set to 'maya1'");
    console.error("   Set it with: export VOICE_PROVIDER=maya1");
    process.exit(1);
  }

  const strict = process.env.STRICT_LATENCY === "1";

  console.log("📋 Configuration:");
  console.log(`   Provider: ${voiceProvider}`);
  console.log(`   Strict Mode: ${strict ? "Enabled" : "Disabled"}`);
  console.log(`   Test Phrase: "${TEST_PHRASE}"\n`);

  try {
    // Initialize pools
    console.log("🚀 Initializing Voice Pools...");
    const initStart = performance.now();
    await initializeVoicePools();
    const initTime = performance.now() - initStart;
    console.log(`✅ Pools initialized in ${initTime.toFixed(2)}ms\n`);

    const { ttsPool, sttPool } = getVoicePools();

    // --- Phase 1: TTS ---
    console.log("🔊 Phase 1: Text-to-Speech (TTS)");
    const ttsStart = performance.now();
    const ttsResult = await ttsPool.synthesize({
      text: TEST_PHRASE,
      voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
      streaming: false,
    });
    const ttsDuration = performance.now() - ttsStart;

    console.log(`   ✅ Synthesized in ${ttsDuration.toFixed(2)}ms`);
    console.log(
      `   Audio size: ${(ttsResult.audioBase64.length * 3) / 4} bytes (base64)`
    );

    if (strict && ttsDuration > LATENCY_THRESHOLDS.tts_p95) {
      throw new Error(
        `TTS latency violation: ${ttsDuration.toFixed(2)}ms > ${LATENCY_THRESHOLDS.tts_p95}ms`
      );
    }

    // --- Phase 2: Codec (Transcode to WAV for STT) ---
    // Note: STT usually accepts WAV or raw PCM if configured.
    // We'll use our codec utility to verify ffmpeg integration too.
    console.log("\n🔄 Phase 2: Transcoding (FFmpeg)");
    const transcodeStart = performance.now();
    const wavResult = await encodeFromPCM16({
      audioBase64: ttsResult.audioBase64,
      format: "wav",
    });
    const transcodeDuration = performance.now() - transcodeStart;
    console.log(`   ✅ Transcoded to WAV in ${transcodeDuration.toFixed(2)}ms`);

    // --- Phase 3: STT ---
    console.log("\n👂 Phase 3: Speech-to-Text (STT)");
    const sttStart = performance.now();
    const sttResult = await sttPool.transcribe({
      audioBase64: wavResult.audioBase64,
      mimeType: "audio/wav",
      language: "en",
      streaming: false,
    });
    const sttDuration = performance.now() - sttStart;
    console.log(`   ✅ Transcribed in ${sttDuration.toFixed(2)}ms`);
    console.log(`   Result: "${sttResult.text}"`);

    if (strict && sttDuration > LATENCY_THRESHOLDS.stt_p95) {
      throw new Error(
        `STT latency violation: ${sttDuration.toFixed(2)}ms > ${LATENCY_THRESHOLDS.stt_p95}ms`
      );
    }

    // --- Phase 4: Verification ---
    console.log("\n✅ Phase 4: Verification");
    const normalizedText = sttResult.text.toLowerCase();
    const missingKeywords = EXPECTED_KEYWORDS.filter(
      (kw) => !normalizedText.includes(kw)
    );

    if (missingKeywords.length > 0) {
      console.error(
        `   ❌ Verification Failed: Missing keywords: ${missingKeywords.join(", ")}`
      );
      console.error(`   Expected: "${TEST_PHRASE}"`);
      console.error(`   Got:      "${sttResult.text}"`);
      process.exit(1);
    }
    console.log("   ✅ Text matches expectations");

    // --- Cleanup ---
    console.log("\n🎉 All runtime verifications passed!");
  } catch (error) {
    console.error("\n❌ Verification Failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    console.log("\n🧹 Shutting down pools...");
    await shutdownVoicePools();
    console.log("✅ Shutdown complete");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
