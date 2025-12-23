import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TTSPool } from "../src/process/tts";

describe.skip("TTSPool with Supertonic Voice Switching (skipped: causes C++ exception in Bun runner)", () => {
  const modelsDir = join(process.cwd(), "models", "supertonic");
  const hasModels = existsSync(join(modelsDir, "tts.json"));

  const config = {
    scriptPath: "dummy.py",
    modelPath: "dummy",
    voice: "dummy",
  };

  it("should switch voices on request", async () => {
    if (!hasModels) {
      console.warn(
        "Skipping Supertonic TTSPool voice switching test because models are missing"
      );
      return;
    }

    process.env.TTS_PROVIDER = "supertonic";
    const pool = new TTSPool(config);

    try {
      await pool.initialize();

      // Request with M1 (default)
      const result1 = await pool.synthesize({ text: "Hello M1", voice: "M1" });
      expect(result1.audioBase64).toBeDefined();

      // Request with F1 (should trigger load)
      const start = Date.now();
      const result2 = await pool.synthesize({ text: "Hello F1", voice: "F1" });
      const duration = Date.now() - start;

      expect(result2.audioBase64).toBeDefined();
      // Voice switching shouldn't take too long if model IO is fast, but it involves reading JSON and allocating tensors
      console.log(`Voice switch and synthesis took ${duration}ms`);

      // Request with F1 again (should be cached if we implemented caching in SupertonicTTS, which we did)
      const start2 = Date.now();
      const _result3 = await pool.synthesize({
        text: "Hello F1 again",
        voice: "F1",
      });
      const duration2 = Date.now() - start2;
      console.log(`Cached voice synthesis took ${duration2}ms`);

      // Should be faster than first load (though first load includes synthesis time too)
    } finally {
      await pool.shutdown();
      process.env.TTS_PROVIDER = undefined;
    }
  }, 30_000);
});
