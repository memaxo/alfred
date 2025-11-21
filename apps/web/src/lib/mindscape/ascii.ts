import { GLYPH_SET, signalToCharIndex } from "./math";

export function calculateAsciiFrame(width: number, height: number) {
  let buffer = "";

  const cols = width;
  const rows = height;

  // Use current day of year as seed for variation (Daily Pulse)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const time = (dayOfYear * 0.1) % 100;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const v = y / rows;

      // Matches MindscapeEngine logic (Interference Pattern)
      const f1 = 10.0;
      const f2 = 8.0;
      const f3 = 13.0;
      const interference =
        Math.sin(u * f1 + time) +
        Math.sin(v * f2 - time) +
        Math.sin((u + v) * f3);

      // Normalize (-3 to 3 -> 0 to 1)
      let intensity = (interference + 3.0) / 6.0;

      // Exponential curve
      intensity **= 3.0;

      const idx = signalToCharIndex(intensity, GLYPH_SET.length);
      buffer += GLYPH_SET[idx];
    }
    buffer += "\n";
  }
  return buffer;
}
