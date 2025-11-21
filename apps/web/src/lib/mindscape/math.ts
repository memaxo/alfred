// apps/web/src/lib/mindscape/math.ts

// Density sorted character set (light to dark)
export const GLYPH_SET =
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export const CELL_WIDTH = 10; // Slightly wider for better legibility
export const CELL_HEIGHT = 20;

// OKLCH colors from design system
export const COLOR_VOID = { l: 0.05, c: 0.0, h: 0.0 };
export const COLOR_BIOLUM = { l: 0.99, c: 0.0, h: 0.0 };

// Helper to convert OKLCH to RGB (approximate for Canvas 2D fallback)
// WebGPU will likely handle this in shader or use native support if available,
// but for Canvas 2D we need an RGB string or values.
// Using a simplified conversion or relying on CSS strings if context allows.
export function oklchToRgb(
  l: number,
  c: number,
  h: number
): [number, number, number] {
  // This is a complex conversion. For the sake of the fallback and simplicity in JS,
  // we might approximate or use a library if available.
  // However, since modern browsers support `oklch()` in CSS colors,
  // for Canvas 2D `fillStyle` we can return a string.
  // But for pixel manipulation (if needed), we need RGB.
  // Let's implement a standard conversion to Linear sRGB for correctness if we manipulate pixels.

  // 1. OKLCH -> OKLAB
  const L = l;
  const a = c * Math.cos(h * (Math.PI / 180));
  const b = c * Math.sin(h * (Math.PI / 180));

  // 2. OKLAB -> Linear sRGB (Simplified matrix)
  // Reference: https://bottosson.github.io/posts/oklab/

  const l_ = L + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const m_ = L - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const s_ = L - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const l__ = l_ * l_ * l_;
  const m__ = m_ * m_ * m_;
  const s__ = s_ * s_ * s_;

  let r =
    +4.076_741_662_1 * l__ - 3.307_711_591_3 * m__ + 0.230_969_929_2 * s__;
  let g =
    -1.268_438_004_6 * l__ + 2.609_757_401_1 * m__ - 0.341_319_396_5 * s__;
  let bl = -0.004_196_086_3 * l__ - 0.703_418_614_7 * m__ + 1.707_614_701 * s__;

  // Clip and Gamma correct (sRGB transfer function)
  const transfer = (v: number) =>
    v <= 0.003_130_8 ? 12.92 * v : 1.055 * v ** (1.0 / 2.4) - 0.055;

  r = transfer(r);
  g = transfer(g);
  bl = transfer(bl);

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bl * 255))),
  ];
}

export function signalToCharIndex(
  intensity: number,
  totalChars: number = GLYPH_SET.length
): number {
  // Map signal intensity I (0.0 to 1.0) to array index using an exponential curve
  // to favor empty space (The Void).
  // Index = floor( I^2.5 * (TotalChars) )
  const idx = Math.floor(intensity ** 2.5 * totalChars);
  return Math.max(0, Math.min(totalChars - 1, idx));
}
