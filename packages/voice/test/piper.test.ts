import { beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
// Try to import directly to debug resolution
import * as piperWasm from "@diffusionstudio/piper-wasm";
import { PiperTTSManager } from "../src/process/piper";

console.log("Piper module:", piperWasm);

describe("PiperTTSManager", () => {
  let manager: PiperTTSManager;
  const modelPath = join(process.cwd(), "packages/voice/models/piper");

  beforeAll(() => {
    manager = new PiperTTSManager({
      modelPath,
      defaultVoice: "en_US-lessac-medium",
    });
  });

  it("should initialize", async () => {
    // We expect this to fail if the WASM module or models are missing
    // But we want to see IF it fails or works.
    // If models are missing, we might need to download them or mock.

    // Check if model exists
    const voicePath = join(modelPath, "en_US-lessac-medium.onnx");
    if (!existsSync(voicePath)) {
      console.warn("Model file not found, skipping initialization test");
      return;
    }

    try {
      await manager.initialize();
      expect(manager.getLoadedVoices()).toContain("en_US-lessac-medium");
    } catch (e) {
      console.error("Initialization failed:", e);
      throw e;
    }
  });

  it("should synthesize text", async () => {
    const voicePath = join(modelPath, "en_US-lessac-medium.onnx");
    if (!existsSync(voicePath)) {
      console.warn("Model file not found, skipping synthesis test");
      return;
    }

    const result = await manager.synthesize("Hello world");
    expect(result.audioBase64).toBeDefined();
    expect(result.mimeType).toBe("audio/pcm");
    expect(result.audioBase64.length).toBeGreaterThan(0);
  });
});
