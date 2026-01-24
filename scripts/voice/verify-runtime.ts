#!/usr/bin/env bun

/**
 * Voice Runtime Verification Script (Level 4)
 *
 * Verifies the local voice runtime without relying on "STT can transcribe our TTS"
 * (not a stable correctness signal across models/voices).
 *
 * Verifies:
 * 1) STT: real speech -> transcript (macOS `say` clip by default)
 * 2) TTS: text -> audio (and codec decode path via `decodeToPCM16`)
 *
 * Usage:
 *   VOICE_PROVIDER=maya1 WHISPER_DEVICE=mps ALFRED_API_AUTO_INIT=false bun scripts/voice/verify-runtime.ts
 *
 * Environment variables:
 *   VOICE_PROVIDER=maya1 (required)
 *   WHISPER_DEVICE=mps (recommended on Apple Silicon)
 *   STRICT_LATENCY=1 (optional, fails on latency violations)
 */

import { spawn } from "bun";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../packages/api/src/voice/pools";
import { decodeToPCM16 } from "../../packages/voice/src/audio/codec";
import { transcribeLocal } from "../../packages/voice/src/services/stt";
import { synthesizeLocal } from "../../packages/voice/src/services/tts";

// Configuration
const TEST_PHRASE = "The quick brown fox jumps over the lazy dog.";
const STT_FIXTURE_TEXT = "Hello Alfred.";

const LATENCY_THRESHOLDS = {
  tts_p95: 1000, // 1s for synthesis start
  stt_p95: 2000, // 2s for transcription
};

async function spawnOk(cmd: string[]) {
  const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (code !== 0) {
    throw new Error(
      "cmd_failed: " +
        cmd.join(" ") +
        " code=" +
        code +
        " stderr=" +
        stderr.trim() +
        " stdout=" +
        stdout.trim()
    );
  }
}

async function resolveSpeechWav(tmpDir: string): Promise<string> {
  if (process.platform === "darwin") {
    const sayAiff = join(tmpDir, "say.aiff");
    const sayWav = join(tmpDir, "say.wav");
    await spawnOk(["say", "-o", sayAiff, STT_FIXTURE_TEXT]);
    await spawnOk([
      "afconvert",
      "-f",
      "WAVE",
      "-d",
      "LEI16@16000",
      "-c",
      "1",
      sayAiff,
      sayWav,
    ]);
    return sayWav;
  }

  const fallback = join(process.cwd(), "scripts/fixtures/hello.wav");
  if (!existsSync(fallback)) {
    throw new Error("no_audio_fixture_available");
  }
  return fallback;
}

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
  console.log(`   STT Fixture: "${STT_FIXTURE_TEXT}"`);
  console.log(`   TTS Phrase: "${TEST_PHRASE}"\n`);

  try {
    const tmpDir = join(process.cwd(), "tmp", "voice");
    await mkdir(tmpDir, { recursive: true });

    // Initialize pools
    console.log("🚀 Initializing Voice Pools...");
    const initStart = performance.now();
    await initializeVoicePools();
    const initTime = performance.now() - initStart;
    console.log(`✅ Pools initialized in ${initTime.toFixed(2)}ms\n`);

    const { ttsPool, sttPool } = getVoicePools();

    // --- Phase 1: STT ---
    console.log("👂 Phase 1: Speech-to-Text (STT)");
    const speechWav = await resolveSpeechWav(tmpDir);
    const wav = await readFile(speechWav);
    const sttStart = performance.now();
    const sttResult = await transcribeLocal(sttPool, {
      audioBase64: wav.toString("base64"),
      mimeType: "audio/wav",
      model:
        process.env.WHISPER_MODEL_PATH ??
        "nvidia/parakeet_realtime_eou_120m-v1",
      language: "en",
    });
    const sttDuration = performance.now() - sttStart;
    console.log(`   ✅ Transcribed in ${sttDuration.toFixed(2)}ms`);
    console.log(`   Result: "${sttResult.text}"`);
    if (!sttResult.text.trim()) {
      throw new Error("stt_empty_transcript");
    }

    if (strict && sttDuration > LATENCY_THRESHOLDS.stt_p95) {
      throw new Error(
        `STT latency violation: ${sttDuration.toFixed(2)}ms > ${LATENCY_THRESHOLDS.stt_p95}ms`
      );
    }

    // --- Phase 2: TTS ---
    console.log("\n🔊 Phase 2: Text-to-Speech (TTS)");
    const ttsStart = performance.now();
    const ttsResult = await synthesizeLocal(ttsPool, {
      text: TEST_PHRASE,
      voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
      format: "wav",
      model: process.env.TTS_MODEL ?? "maya1",
    });
    const ttsDuration = performance.now() - ttsStart;
    console.log(`   ✅ Synthesized in ${ttsDuration.toFixed(2)}ms`);
    console.log(
      `   Audio size: ${(ttsResult.audioBase64.length * 3) / 4} bytes (base64)`
    );
    if (!ttsResult.audioBase64.trim()) {
      throw new Error("tts_empty_audio");
    }

    const decoded = await decodeToPCM16({
      audioBase64: ttsResult.audioBase64,
      mimeType: ttsResult.mimeType,
    });
    const pcmBytes = Math.ceil((decoded.audioBase64.length * 3) / 4);
    console.log(`   ✅ Decoded to PCM16: ${pcmBytes} bytes`);

    if (strict && ttsDuration > LATENCY_THRESHOLDS.tts_p95) {
      throw new Error(
        `TTS latency violation: ${ttsDuration.toFixed(2)}ms > ${LATENCY_THRESHOLDS.tts_p95}ms`
      );
    }

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
