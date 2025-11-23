import { describe, it, expect } from "bun:test";
import { TTSPool } from "../src/process/tts";
import { join } from "node:path";
import { existsSync } from "node:fs";

describe("TTSPool with Supertonic Streaming", () => {
  const modelsDir = join(process.cwd(), "models", "supertonic");
  const hasModels = existsSync(join(modelsDir, "tts.json"));

  const config = {
    scriptPath: "dummy.py",
    modelPath: "dummy",
    voice: "dummy",
  };

  it("should stream chunks", async () => {
    if (!hasModels) {
      console.warn("Skipping Supertonic streaming test because models are missing");
      return;
    }

    process.env.TTS_PROVIDER = "supertonic";
    const pool = new TTSPool(config);
    
    try {
      await pool.initialize();
      
      let chunks = 0;
      const start = Date.now();
      
      const result = await pool.synthesize({ 
        text: "Hello. This is sentence one. This is sentence two." 
      }, (chunk) => {
        chunks++;
        expect(chunk.audioBase64).toBeDefined();
        expect(chunk.audioBase64.length).toBeGreaterThan(0);
        console.log(`Received chunk ${chunks} at ${Date.now() - start}ms`);
      });

      expect(result.audioBase64).toBeDefined();
      expect(chunks).toBeGreaterThan(1); // Should be at least 2 chunks (2 sentences) + maybe last chunk
      console.log(`Total chunks: ${chunks}`);
      
    } finally {
      await pool.shutdown();
      delete process.env.TTS_PROVIDER;
    }
  }, 30000);
});
