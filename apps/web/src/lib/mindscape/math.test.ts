import { describe, expect, test } from "bun:test";
import { GLYPH_SET, oklchToRgb, signalToCharIndex } from "./math";

describe("Mindscape Math", () => {
  test("signalToCharIndex maps 0 to 0", () => {
    expect(signalToCharIndex(0)).toBe(0);
  });

  test("signalToCharIndex maps 1 to last char", () => {
    expect(signalToCharIndex(1)).toBe(GLYPH_SET.length - 1);
  });

  test("signalToCharIndex favors lower indices (exponential)", () => {
    // 0.5^2.5 * 64 approx 0.17 * 64 = 11
    // Linear would be 32
    const idx = signalToCharIndex(0.5);
    expect(idx).toBeLessThan(GLYPH_SET.length / 2);
  });

  test("oklchToRgb returns valid RGB", () => {
    const [r, g, b] = oklchToRgb(0.5, 0.2, 270);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });
});
