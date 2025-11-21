import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SupertonicTTS } from "../src/process/supertonic";

describe("SupertonicTTS", () => {
  const modelsDir = join(process.cwd(), "models", "supertonic");
  const hasModels = existsSync(join(modelsDir, "tts.json"));

  it("should instantiate", () => {
    const tts = new SupertonicTTS({
      modelPath: modelsDir,
      defaultVoice: "M1.json",
    });
    expect(tts).toBeDefined();
  });

  it("should synthesize speech", async () => {
    if (!hasModels) {
      console.warn(
        "Skipping Supertonic synthesis test because models are missing"
      );
      return;
    }

    const tts = new SupertonicTTS({
      modelPath: modelsDir,
      defaultVoice: "M1.json",
    });

    await tts.initialize();

    const result = await tts.synthesize("Hello world, this is a test.");

    expect(result).toBeDefined();
    expect(result.audio).toBeInstanceOf(Float32Array);
    expect(result.audio.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);

    console.log(`Generated ${result.duration.toFixed(2)}s of audio`);
  }, 30_000); // 30s timeout
});
