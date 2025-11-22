#!/usr/bin/env bun

/**
 * TTS Test Script
 *
 * Tests the local TTS implementation by:
 * 1. Initializing voice pools
 * 2. Synthesizing text to speech
 * 3. Testing streaming synthesis
 * 4. Displaying health status
 *
 * Usage:
 *   bun run scripts/test-tts.ts "Hello, this is a test"
 *
 * Environment variables:
 *   VOICE_PROVIDER=local (required)
 *   PIPER_MODEL_PATH (optional, defaults to ./packages/voice/models/piper)
 *   PIPER_VOICE (optional, defaults to en_US-lessac-medium)
 *   VOICE_TTS_POOL_SIZE (optional, defaults to 2)
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../packages/api/src/voice/pools";

const text =
  process.argv[2] ??
  "Hello, this is ALFRED. I am testing text-to-speech synthesis.";

async function main() {
  console.log("🎤 ALFRED TTS Test Script\n");
  console.log(`Text to synthesize: "${text}"\n`);

  // Check environment
  const voiceProvider = process.env.VOICE_PROVIDER ?? "openai";
  if (voiceProvider !== "local") {
    console.error("❌ VOICE_PROVIDER must be set to 'local'");
    console.error("   Set it with: export VOICE_PROVIDER=local");
    process.exit(1);
  }

  console.log("📋 Configuration:");
  console.log(`   Provider: ${voiceProvider}`);
  console.log(
    `   Model Path: ${process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper"}`
  );
  console.log(`   Voice: ${process.env.PIPER_VOICE ?? "en_US-lessac-medium"}`);
  console.log(`   Pool Size: ${process.env.VOICE_TTS_POOL_SIZE ?? "2"}\n`);

  try {
    // Initialize pools
    console.log("🚀 Initializing TTS pool...");
    await initializeVoicePools();
    console.log("✅ TTS pool initialized\n");

    const { ttsPool } = getVoicePools();

    // Check health
    console.log("🏥 Health Status:");
    const health = ttsPool.getHealth();
    health.forEach((h, i) => {
      console.log(`   Process ${i + 1}:`);
      console.log(`     Healthy: ${h.isHealthy ? "✅" : "❌"}`);
      console.log(`     Uptime: ${Math.round(h.uptime / 1000)}s`);
      console.log(`     Requests: ${h.requestCount}`);
      console.log(`     Errors: ${h.errorCount}`);
      console.log(
        `     Last Ping: ${h.lastPing ? new Date(h.lastPing).toISOString() : "never"}`
      );
    });
    console.log();

    // Test 1: Basic synthesis
    console.log("🔊 Test 1: Basic Synthesis");
    const start1 = performance.now();
    const result1 = await ttsPool.synthesize({
      text,
      voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
      streaming: false,
    });
    const duration1 = performance.now() - start1;
    console.log(`   ✅ Synthesized in ${duration1.toFixed(2)}ms`);
    console.log(
      `   Audio size: ${(result1.audioBase64.length * 3) / 4} bytes (base64)`
    );
    console.log(`   MIME type: ${result1.mimeType}`);
    console.log(`   Sample rate: ${result1.sampleRate ?? "unknown"} Hz\n`);

    // Save audio file
    const audioBuffer = Buffer.from(result1.audioBase64, "base64");
    const outputPath = join(process.cwd(), "tmp", "test-tts-output.pcm");
    await writeFile(outputPath, audioBuffer);
    console.log(`   💾 Saved audio to: ${outputPath}`);
    console.log(
      `   💡 Play with: ffplay -f s16le -ar ${result1.sampleRate ?? 22_050} -ac 1 ${outputPath}\n`
    );

    // Test 2: Streaming synthesis
    console.log("🌊 Test 2: Streaming Synthesis");
    const start2 = performance.now();
    let chunkCount = 0;
    let totalAudioSize = 0;

    await ttsPool.synthesize(
      {
        text:
          text +
          " This is a longer sentence to test streaming. It should be split into multiple chunks.",
        voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
        streaming: true,
      },
      (chunk) => {
        chunkCount++;
        totalAudioSize += chunk.audioBase64.length;
        console.log(
          `   📦 Chunk ${chunkCount}: ${chunk.audioBase64.length} bytes`
        );
      }
    );
    const duration2 = performance.now() - start2;
    console.log(
      `   ✅ Streamed ${chunkCount} chunks in ${duration2.toFixed(2)}ms`
    );
    console.log(
      `   Total audio size: ${(totalAudioSize * 3) / 4} bytes (base64)\n`
    );

    // Test 3: Multiple concurrent requests
    console.log("⚡ Test 3: Concurrent Requests");
    const start3 = performance.now();
    const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
      ttsPool.synthesize({
        text: `Request ${i + 1}: ${text}`,
        voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
        streaming: false,
      })
    );
    const results3 = await Promise.all(concurrentPromises);
    const duration3 = performance.now() - start3;
    console.log(
      `   ✅ Completed ${results3.length} concurrent requests in ${duration3.toFixed(2)}ms`
    );
    console.log(
      `   Average: ${(duration3 / results3.length).toFixed(2)}ms per request\n`
    );

    // Final health check
    console.log("🏥 Final Health Status:");
    const finalHealth = ttsPool.getHealth();
    finalHealth.forEach((h, i) => {
      console.log(`   Process ${i + 1}:`);
      console.log(`     Requests: ${h.requestCount}`);
      console.log(`     Errors: ${h.errorCount}`);
    });
    console.log();

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:");
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    console.log("🧹 Shutting down TTS pool...");
    await shutdownVoicePools();
    console.log("✅ Shutdown complete");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
