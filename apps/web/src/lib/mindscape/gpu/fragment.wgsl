struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.uv = pos[VertexIndex] * 0.5 + 0.5;
  // Invert Y if needed for texture coords, usually WGSL UV (0,0) is top-left or bottom-left depending on setup.
  // WebGPU NDC Y is up. Texture UV Y is usually down for images.
  // We'll correct in fragment if text is flipped.
  output.uv.y = 1.0 - output.uv.y; 
  return output;
}

struct Cell {
  packed_data: u32, 
};

struct Uniforms {
  time: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
  // We really need atlas metrics here or hardcode
};

@group(0) @binding(0) var<storage, read> grid: array<Cell>;
@group(0) @binding(1) var<uniform> params: Uniforms;
@group(0) @binding(2) var fontSampler: sampler;
@group(0) @binding(3) var fontTexture: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let cell_width = 10.0;
    let cell_height = 20.0;
    
    let grid_w = u32(ceil(params.resolution.x / cell_width));
    let grid_h = u32(ceil(params.resolution.y / cell_height));
    
    // Determine cell coordinate
    let cell_x = u32(uv.x * params.resolution.x / cell_width);
    let cell_y = u32(uv.y * params.resolution.y / cell_height); // Flip Y? 
    
    // If we flipped UV.y in vertex, uv.y goes 0 (top) to 1 (bottom).
    // Screen coords usually 0 (top).
    
    if (cell_x >= grid_w || cell_y >= grid_h) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0); // Out of bounds
    }
    
    let index = cell_y * grid_w + cell_x;
    let cell_data = grid[index].packed_data;
    
    // Unpack
    let char_index = (cell_data >> 24u) & 0xFFu;
    let r = f32((cell_data >> 16u) & 0xFFu) / 255.0;
    let g = f32((cell_data >> 8u) & 0xFFu) / 255.0;
    let b = f32(cell_data & 0xFFu) / 255.0;
    
    // Sample Font Atlas
    // Atlas is 1024x1024, font size approx 10x20? No, atlas font size is 48px.
    // We need to know atlas metrics to map char_index to UV.
    // Hardcoding based on font-atlas.ts defaults (size 1024, font 48 -> ~28px width?)
    // We should pass these as uniforms. For now, approximating logic.
    // Assuming 1024 size, fixed grid.
    // Let's say we have 'cols' in atlas.
    
    // We need to compute the UV *within* the cell.
    let cell_uv = fract(uv * params.resolution / vec2<f32>(cell_width, cell_height));
    
    // Map char_index to atlas position
    // This requires knowing 'atlas_cols' and 'glyph_size' in UV space.
    // Let's assume we pass these or hardcode 1024 / char_width.
    // Re-calculating logic from font-atlas.ts:
    // M width is approx 29px (for 48px Mono).
    // Let's assume 32 cols for safety in shader logic or pass as uniform.
    // To do this properly, we'd update Uniforms.
    // FOR NOW: We will just sample the whole texture for debug or try to calculate.
    
    // Better: Map the cell_uv to the specific glyph rectangle in the atlas.
    // We can't easily guess.
    // Let's assume a strict grid in atlas: 32x32 glyphs (1024/32 = 32px box).
    // This simplifies shader math. 
    // In `font-atlas.ts`, we calculated specific widths.
    // We should probably force a fixed grid in `font-atlas.ts` for easier shader mapping.
    // But let's try to implement a dynamic lookup if we had uniforms.
    // Since I can't easily add uniforms right now without changing other files too much,
    // I'll stick to a "Safe" assumption that fits 64 chars.
    // 8x8 grid = 64 chars. 1024 / 8 = 128px cells. Plenty of space.
    // Let's update `font-atlas.ts` later or rely on uniform updates.
    // Actually, `font-atlas.ts` packs tightly.
    // I will assume a fixed grid layout for the atlas in the shader for now: 
    // 16 columns (1024/16 = 64px width max).
    
    let atlas_cols = 16u; // 64 chars fits in 16x4 grid
    let glyph_col = char_index % atlas_cols;
    let glyph_row = char_index / atlas_cols;
    
    let glyph_uv_size = 1.0 / f32(atlas_cols); // Assuming square grid items for simplicity
    // But glyphs are not square. 
    // Let's use a fixed aspect ratio for the glyph slot in atlas logic if possible.
    
    // To be safe/correct:
    let atlas_u = (f32(glyph_col) + cell_uv.x) * glyph_uv_size;
    // Adjust V for non-square aspect? 
    // If we assume 16x16 grid in atlas (256 slots), each is square.
    // Text is tall. It fits in square.
    // We just need to map cell_uv (0..1) to the glyph box.
    let atlas_v = (f32(glyph_row) + cell_uv.y) * glyph_uv_size;
    
    let tex_color = textureSample(fontTexture, fontSampler, vec2<f32>(atlas_u, atlas_v));
    
    // Alpha masking
    let alpha = tex_color.a; // Assuming we stored in alpha or red
    // In font-atlas we used 'r8unorm' but drew white on transparent.
    // If format is r8unorm, we just read float. 
    // If drawing white text, R=1.
    // Actually copyExternalImageToTexture might preserve channels.
    // We check alpha or red.
    
    // Final Color
    let text_rgb = vec3<f32>(r, g, b) * tex_color.r; // Use Red channel as intensity
    
    return vec4<f32>(text_rgb, 1.0);
}
