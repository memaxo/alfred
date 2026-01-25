#!/usr/bin/env bun

/**
 * STT Test Script
 *
 * Tests the local Parakeet STT implementation by:
 * 1. Initializing voice pools
 * 2. Downloading a sample audio file
 * 3. Transcribing audio (local provider)
 * 4. Displaying health status
 *
 * Usage:
 *   bun run scripts/test-stt.ts
 *
 * Environment variables:
 *   VOICE_PROVIDER=maya1 (required)
 *   WHISPER_MODEL_PATH (optional, defaults to nvidia/parakeet_realtime_eou_120m-v1)
 *   VOICE_STT_POOL_SIZE (optional, defaults to 2)
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../packages/api/src/voice/pools";

// Generate a 1 second sine wave wav file (16khz, mono, 16bit)
function generateSineWaveWav(): Buffer {
  const sampleRate = 16_000;
  const duration = 1;
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // data
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 32_767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function main() {
  console.log("🎤 ALFRED STT Test Script (Parakeet)\n");

  // Check environment
  const voiceProvider = process.env.VOICE_PROVIDER ?? "maya1";
  if (voiceProvider !== "maya1") {
    console.error("❌ VOICE_PROVIDER must be set to 'maya1'");
    console.error("   Set it with: export VOICE_PROVIDER=maya1");
    process.exit(1);
  }
  process.env.VOICE_PROVIDER = "maya1"; // Force it just in case

  console.log("📋 Configuration:");
  console.log(`   Provider: ${voiceProvider}`);
  console.log(
    `   Model Path: ${process.env.WHISPER_MODEL_PATH ?? "nvidia/parakeet_realtime_eou_120m-v1"}`
  );
  console.log(`   Pool Size: ${process.env.VOICE_STT_POOL_SIZE ?? "2"}\n`);

  // Ensure tmp dir
  const tmpDir = join(process.cwd(), "tmp");
  if (!existsSync(tmpDir)) {
    await mkdir(tmpDir, { recursive: true });
  }

  const audioPath = join(tmpDir, "sine-wave.wav");

  try {
    // Generate sample if needed
    if (existsSync(audioPath)) {
      console.log(`✅ Using existing sample audio at ${audioPath}\n`);
    } else {
      console.log("⬇️  Generating sine wave sample...");
      const buffer = generateSineWaveWav();
      await writeFile(audioPath, buffer);
      console.log(`✅ Saved sample audio to ${audioPath}\n`);
    }

    // Read audio and convert to base64
    const audioBuffer = await readFile(audioPath);
    const audioBase64 = audioBuffer.toString("base64");
    console.log(`📊 Audio size: ${audioBuffer.length} bytes`);

    // Initialize pools
    console.log(
      "🚀 Initializing STT pool (this triggers model download if needed)..."
    );
    const initStart = performance.now();
    await initializeVoicePools();
    const initDuration = (performance.now() - initStart) / 1000;
    console.log(`✅ STT pool initialized in ${initDuration.toFixed(2)}s\n`);

    // Log startup latency metric
    console.log("📊 Metrics:");
    console.log(`   Startup Latency: ${initDuration.toFixed(2)}s`);

    const { sttPool } = getVoicePools();

    // Check health
    console.log("🏥 Health Status:");
    const health = sttPool.getHealth();
    health.forEach((h, i) => {
      console.log(`   Process ${i + 1}:`);
      console.log(`     Healthy: ${h.isHealthy ? "✅" : "❌"}`);
      console.log(`     Uptime: ${Math.round(h.uptime / 1000)}s`);
    });
    console.log();

    // Test 1: Basic transcription
    console.log("📝 Test 1: Basic Transcription");
    const start1 = performance.now();
    const result1 = await sttPool.transcribe({
      audioBase64,
      mimeType: "audio/wav",
      language: "en",
    });
    const duration1 = performance.now() - start1;
    const audioDuration = result1.durationSeconds ?? 1;
    const rtf = duration1 / 1000 / audioDuration;

    console.log(`   ✅ Transcribed in ${duration1.toFixed(2)}ms`);
    console.log(`   Text: "${result1.text}"`);
    console.log(`   Confidence: ${result1.vadConfidence ?? "N/A"}`);
    console.log(`   Duration (audio): ${result1.durationSeconds?.toFixed(2)}s`);
    console.log(
      `   RTF (Real-Time Factor): ${rtf.toFixed(2)}x (lower is faster)\n`
    );

    // Test 2: Concurrent requests
    console.log("⚡ Test 2: Concurrent Requests");
    const start2 = performance.now();
    const promises = Array.from({ length: 3 }, (_, i) =>
      sttPool
        .transcribe({
          audioBase64,
          mimeType: "audio/wav",
        })
        .then((res) => ({ id: i, ...res }))
    );

    const results = await Promise.all(promises);
    const duration2 = performance.now() - start2;
    console.log(
      `   ✅ Completed 3 concurrent requests in ${duration2.toFixed(2)}ms`
    );
    results.forEach((r) => {
      console.log(`     req[${r.id}]: "${r.text.slice(0, 30)}..."`);
    });
    console.log();

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    console.log("🧹 Shutting down STT pool...");
    await shutdownVoicePools();
  }
}

main();
