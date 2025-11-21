import { expect, test, describe, mock } from "bun:test";
import { createFontAtlas } from "./font-atlas";

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext(type: string) {
    if (type === '2d') {
      return {
        measureText: () => ({ width: 10 }),
        clearRect: () => {},
        fillText: () => {},
      };
    }
    return null;
  }
}

global.OffscreenCanvas = MockOffscreenCanvas as any;

describe("Font Atlas", () => {
  test("createFontAtlas returns valid structure", () => {
    const atlas = createFontAtlas();
    expect(atlas).toBeDefined();
    expect(atlas.texture).toBeInstanceOf(MockOffscreenCanvas);
    expect(atlas.cols).toBe(16);
    expect(atlas.glyphWidth).toBeGreaterThan(0);
    expect(atlas.glyphHeight).toBeGreaterThan(0);
  });

  test("Atlas dimensions are power of 2", () => {
    const atlas = createFontAtlas();
    const canvas = atlas.texture as any;
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(1024);
  });
});
