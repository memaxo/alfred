import { describe, expect, test } from "bun:test";

describe("voice router imports", () => {
  test("does not import heavy voice services at module load time", async () => {
    const urls = [
      new URL("../src/routers/voice.ts", import.meta.url),
      new URL("../src/routers/voice/schema.ts", import.meta.url),
      new URL("../src/routers/voice/stt.ts", import.meta.url),
      new URL("../src/routers/voice/tts.ts", import.meta.url),
      new URL("../src/routers/voice/model.ts", import.meta.url),
      new URL("../src/routers/voice/s2s.ts", import.meta.url),
    ];
    const parts = await Promise.all(urls.map((url) => Bun.file(url).text()));
    const src = parts.join("\n\n");

    // These modules can trigger expensive ML/runtime initialization and must only be loaded lazily.
    // Allow `import type` (erased at runtime), but disallow value imports.
    expect(src).not.toMatch(
      /^import(?!\s+type)\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/stt"[^;]*;/m
    );
    expect(src).not.toMatch(
      /^import(?!\s+type)\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/tts"[^;]*;/m
    );
    expect(src).not.toMatch(
      /^import(?!\s+type)\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/models"[^;]*;/m
    );

    // Ensure we keep lazy imports in place.
    expect(src).toContain('import("@alfred/voice/services/stt")');
    expect(src).toContain('import("@alfred/voice/services/tts")');
    expect(src).toContain('import("@alfred/voice/services/models")');
  });
});
