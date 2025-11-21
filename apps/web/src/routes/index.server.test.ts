import { describe, expect, test } from "bun:test";
import { calculateAsciiFrame } from "@/lib/mindscape/ascii";
import { GLYPH_SET } from "@/lib/mindscape/math";

describe("SSR Generation", () => {
  test("calculateAsciiFrame returns string", () => {
    const frame = calculateAsciiFrame(10, 5);
    expect(typeof frame).toBe("string");
  });

  test("calculateAsciiFrame has correct dimensions", () => {
    const w = 20;
    const h = 10;
    const frame = calculateAsciiFrame(w, h);

    const lines = frame.split("\n");
    // Last line might be empty due to trailing newline
    const rows = lines.filter((l) => l.length > 0);

    expect(rows.length).toBe(h);
    expect(rows[0].length).toBe(w);
  });

  test("calculateAsciiFrame uses valid glyphs", () => {
    const frame = calculateAsciiFrame(10, 5);
    for (const char of frame) {
      if (char === "\n") {
        continue;
      }
      expect(GLYPH_SET.includes(char)).toBe(true);
    }
  });
});
