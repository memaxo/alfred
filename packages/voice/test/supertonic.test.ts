import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SupertonicTTS } from "../src/process/supertonic";

const describeSupertonic = describe;

describeSupertonic("SupertonicTTS", () => {
  const modelsDir = join(process.cwd(), "models", "supertonic");
  const hasModels = existsSync(join(modelsDir, "tts.json"));

  // Track all instances for cleanup
  const instances: SupertonicTTS[] = [];

  afterAll(async () => {
    // Ensure all instances are cleaned up
    await Promise.allSettled(
      instances.map((tts) => tts.shutdown().catch(() => {}))
    );
    instances.length = 0;
  });

  it("should instantiate", () => {
    const { SupertonicTTS } =
      require("../src/process/supertonic") as typeof import("../src/process/supertonic");
    const tts = new SupertonicTTS({
      modelPath: modelsDir,
      defaultVoice: "M1.json",
    });
    instances.push(tts);
    expect(tts).toBeDefined();
  });

  it("should synthesize speech", async () => {
    if (process.env.CI === "true" && process.env.RUN_VOICE_POOL_TESTS !== "1") {
      console.warn(
        "Skipping Supertonic synthesis test on CI (RUN_VOICE_POOL_TESTS!=1)"
      );
      return;
    }
    if (!hasModels) {
      console.warn(
        "Skipping Supertonic synthesis test because models are missing"
      );
      return;
    }

    const { SupertonicTTS } = await import("../src/process/supertonic");

    const tts = new SupertonicTTS({
      modelPath: modelsDir,
      defaultVoice: "M1.json",
    });
    instances.push(tts);

    try {
      await tts.initialize();

      const result = await tts.synthesize("Hello world, this is a test.");

      expect(result).toBeDefined();
      expect(result.audio).toBeInstanceOf(Float32Array);
      expect(result.audio.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      console.log(`Generated ${result.duration.toFixed(2)}s of audio`);
    } finally {
      // Ensure cleanup even if test assertions fail
      await tts.shutdown();
    }
  }, 30_000); // 30s timeout
});
