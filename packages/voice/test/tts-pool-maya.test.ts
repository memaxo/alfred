import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { TTSPool } from "../src/process/tts";

describe("TTSPool with Maya1 (skipped: causes C++ exception in Bun runner)", () => {
  if (process.env.CI === "true" && process.env.RUN_VOICE_POOL_TESTS !== "1") {
    console.warn("Skipping Maya1 TTSPool test on CI (RUN_VOICE_POOL_TESTS!=1)");
    return;
  }
  const isPackageRoot = existsSync(join(process.cwd(), "scripts/maya.py"));
  const scriptPath = isPackageRoot
    ? join(process.cwd(), "scripts/maya.py")
    : join(process.cwd(), "packages/voice/scripts/maya.py");

  // Only run if script exists (sanity check)
  if (!existsSync(scriptPath)) {
    console.warn(`Skipping Maya1 test: script not found at ${scriptPath}`);
    return;
  }

  const config = {
    scriptPath,
    modelPath: "maya-research/maya1", // Passed to env var but Maya uses HF directly
    voice: "Default",
  };

  let pool: TTSPool;

  afterAll(async () => {
    if (pool) {
      await pool.shutdown();
    }
  });

  it("should initialize and synthesize using Maya1", async () => {
    // Ensure we use Maya1 (not Supertonic)
    process.env.TTS_PROVIDER = undefined;

    pool = new TTSPool(config, 1); // Pool size 1 for heavy model

    try {
      await pool.initialize();
      console.log("Maya1 initialized");

      const start = Date.now();

      let chunks = 0;
      const result = await pool.synthesize(
        {
          text: "Hello world, this is a test of the Maya voice system.",
          streaming: true,
        },
        (_chunk) => {
          chunks++;
          // Maya sends chunks as they are generated
          if (chunks === 1) {
            console.log(`First chunk received after ${Date.now() - start}ms`);
          }
        }
      );

      console.log(`Synthesis complete. Total chunks: ${chunks}`);
      console.log(`Total time: ${Date.now() - start}ms`);

      // For streaming, Maya returns empty final payload, but chunks should be received
      expect(result.audioBase64).toBeDefined();
      if (chunks === 0) {
        expect(result.audioBase64.length).toBeGreaterThan(0);
      } else {
        expect(chunks).toBeGreaterThan(0);
      }
    } catch (error) {
      console.error("Maya1 test failed:", error);
      throw error;
    }
  }, 120_000); // 2 minutes timeout for initialization and generation
});
