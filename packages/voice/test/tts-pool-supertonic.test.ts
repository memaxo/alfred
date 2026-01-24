import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { TTSPool } from "../src/process/tts";

const describeSupertonic = describe;

describeSupertonic("TTSPool with Supertonic", () => {
  const modelsDir = join(process.cwd(), "models", "supertonic");
  const hasModels = existsSync(join(modelsDir, "tts.json"));

  // Mock config (not used for Supertonic but required by constructor)
  const config = {
    scriptPath: "dummy.py",
    modelPath: "dummy",
    voice: "dummy",
  };

  it("should initialize and synthesize using Supertonic when env var is set", async () => {
    if (process.env.CI === "true" && process.env.RUN_VOICE_POOL_TESTS !== "1") {
      console.warn(
        "Skipping TTSPool Supertonic test on CI (RUN_VOICE_POOL_TESTS!=1)"
      );
      return;
    }
    if (!hasModels) {
      console.warn(
        "Skipping Supertonic TTSPool test because models are missing"
      );
      return;
    }

    // Set environment variable
    process.env.TTS_PROVIDER = "supertonic";

    const pool = new TTSPool(config);

    try {
      await pool.initialize();

      // Check if it's using Supertonic (size should be 1)
      expect(pool.size).toBe(1);

      const start = Date.now();
      const result = await pool.synthesize({
        text: "Hello from Supertonic pool.",
      });
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.audioBase64).toBeDefined();
      expect(result.audioBase64.length).toBeGreaterThan(0);
      expect(result.mimeType).toBe("audio/pcm");

      console.log(`Pool synthesis took ${duration}ms`);
    } finally {
      await pool.shutdown();
      process.env.TTS_PROVIDER = undefined;
    }
  }, 30_000);
});
