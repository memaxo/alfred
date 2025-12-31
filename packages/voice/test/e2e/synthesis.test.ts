import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { TTSPool } from "../../src/process/tts";

// High-level E2E test using the Node.js wrapper
describe("TTS End-to-End Synthesis (skipped: causes C++ exception in Bun runner)", () => {
  // Point to the directory containing __main__.py
  const scriptPath = join(process.cwd(), "packages/voice/python/tts");

  const config = {
    scriptPath,
    modelPath: "maya-research/maya1", // Ignored by factory but passed for config
    voice: "Default",
    // Ensure we use the venv python if running from root
    env: {
      // Override python path if needed, but Process class usually finds it
    },
  };

  let pool: TTSPool;

  beforeAll(() => {
    // Override environment to force Maya1
    process.env.TTS_PROVIDER = undefined;
  });

  afterAll(async () => {
    if (pool) {
      await pool.shutdown();
    }
  });

  it("should synthesize audio using the active backend", async () => {
    pool = new TTSPool(config, 1);

    await pool.initialize();
    console.log("Pool initialized");

    const start = Date.now();
    let chunkCount = 0;
    let totalBytes = 0;

    const result = await pool.synthesize(
      {
        text: "This is an end-to-end test of the dual backend architecture.",
        streaming: true,
      },
      (chunk) => {
        chunkCount++;
        totalBytes += chunk.audioBase64.length;
      }
    );

    const duration = Date.now() - start;
    console.log(
      `Synthesis took ${duration}ms, received ${chunkCount} chunks, ${totalBytes} bytes (base64)`
    );

    // E2E verification: result should be valid
    expect(result).toBeDefined();
    // Streaming with callback might return empty audioBase64 in result, checking chunks
    if (chunkCount > 0) {
      expect(totalBytes).toBeGreaterThan(0);
    } else {
      // Result may be undefined if synthesis fails or backend unavailable
      expect(result?.audioBase64).toBeDefined();
      if (result?.audioBase64) {
        expect(result.audioBase64.length).toBeGreaterThan(0);
      }
    }

    // Verify caching works (second request should be faster)
    const start2 = Date.now();
    await pool.synthesize({
      text: "This is an end-to-end test of the dual backend architecture.",
      streaming: false,
    });
    const duration2 = Date.now() - start2;
    console.log(`Cached synthesis took ${duration2}ms`);

    expect(duration2).toBeLessThan(duration);
    expect(duration2).toBeLessThan(200); // Should be near instant
  }, 60_000);
});
