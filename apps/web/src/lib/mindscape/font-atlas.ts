import { GLYPH_SET } from "./math";

export type FontAtlas = {
  texture: GPUTexture | OffscreenCanvas;
  glyphWidth: number;
  glyphHeight: number;
  cols: number;
  rows: number;
};

export function createFontAtlas(device?: GPUDevice): FontAtlas {
  // Atlas settings
  const atlasSize = 1024;
  const fontSize = 48; // High res for SDF/sharpness
  const fontFamily = "monospace";

  // Use OffscreenCanvas to draw glyphs
  const canvas = new OffscreenCanvas(atlasSize, atlasSize);
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    throw new Error("Failed to create OffscreenCanvas context for FontAtlas");
  }

  // Setup font
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";

  // Measure approximate grid
  // We want to pack all chars into the atlas
  const totalChars = GLYPH_SET.length;

  // Measure 'M' to get max width
  const metrics = ctx.measureText("M");
  const charWidth = Math.ceil(metrics.width);
  const charHeight = Math.ceil(fontSize * 1.2); // Line height

  const cols = 16; // Fixed columns for shader simplicity
  const cellWidth = atlasSize / cols; // 64px
  const cellHeight = cellWidth; // Square cells in atlas
  const rows = Math.ceil(totalChars / cols);

  // Clear
  ctx.clearRect(0, 0, atlasSize, atlasSize);

  // Draw Glyphs
  for (let i = 0; i < totalChars; i++) {
    const char = GLYPH_SET[i];
    if (!char) {
      continue;
    }
    const x = (i % cols) * cellWidth;
    const y = Math.floor(i / cols) * cellHeight;

    // Center the glyph in the cell
    const xOffset = (cellWidth - charWidth) / 2;
    const yOffset = (cellHeight - charHeight) / 2;

    ctx.fillText(char, x + xOffset, y + yOffset);
  }

  let texture: GPUTexture | OffscreenCanvas = canvas;

  if (device) {
    // Upload to WebGPU Texture
    const gpuTexture = device.createTexture({
      size: [atlasSize, atlasSize, 1],
      format: "r8unorm", // We only need alpha/intensity
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Need to convert canvas to bitmap or data to upload
    // OffscreenCanvas can be source for copyExternalImageToTexture
    device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture: gpuTexture },
      [atlasSize, atlasSize]
    );

    texture = gpuTexture;
  }

  return {
    texture,
    glyphWidth: charWidth,
    glyphHeight: charHeight,
    cols,
    rows,
  };
}
