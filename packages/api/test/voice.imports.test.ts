import { describe, expect, test } from "bun:test";

describe("voice router imports", () => {
  test("does not import heavy voice services at module load time", async () => {
    const url = new URL("../src/routers/voice.ts", import.meta.url);
    const src = await Bun.file(url).text();

    // These modules can trigger expensive ML/runtime initialization and must only be loaded lazily.
    // Allow `import type` (erased at runtime), but disallow value imports.
    expect(src).not.toMatch(
      /^import\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/stt"[^;]*;/m
    );
    expect(src).not.toMatch(
      /^import\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/tts"[^;]*;/m
    );
    expect(src).not.toMatch(
      /^import\s+\{[^;]*\}\s+from\s+"@alfred\/voice\/services\/models"[^;]*;/m
    );

    // Ensure we keep lazy imports in place.
    expect(src).toContain('import("@alfred/voice/services/stt")');
    expect(src).toContain('import("@alfred/voice/services/tts")');
    expect(src).toContain('import("@alfred/voice/services/models")');
  });
});
