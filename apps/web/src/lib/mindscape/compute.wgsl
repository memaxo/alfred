struct Uniforms {
  time: f32,
  audio: f32, // Audio Intensity
  resolution: vec2<f32>,
  mouse: vec2<f32>,
};

struct Cell {
  packed_data: u32, 
};

@group(0) @binding(0) var<storage, read_write> grid: array<Cell>;
@group(0) @binding(1) var<uniform> params: Uniforms;

// Helper: Rotate vector
fn rot2d(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

// Signed Distance Field: Octahedron
fn sdOctahedron(p: vec3<f32>, s: f32) -> f32 {
  let p_abs = abs(p);
  return (p_abs.x + p_abs.y + p_abs.z - s) * 0.57735027;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    // Map grid index to 1D array index
    // Assuming grid dimensions are derived from resolution / cell_size
    // But for now, let's assume a fixed width passed or calculated. 
    // Since we don't have width in uniforms yet, let's use params.resolution to deduce.
    // We'll assume cell size of 10x20 as defined in math.ts (roughly)
    // Actually, the 'grid' array size and indexing depends on how many Workgroups we dispatch.
    // Let's map ID directly to buffer index if we dispatch precisely.
    
    // However, to be safe with arbitrary resolution, we usually pass grid dimensions.
    // For this implementation, I'll assume the dispatch covers the screen.
    
    // We need the grid width in cells to calculate index.
    // Let's assume the host passes `gridWidth` in uniforms or we calculate it.
    // Adding grid_width to Uniforms would be cleaner, but sticking to plan structure:
    // We'll approximate or use X coordinate for now.
    
    // Wait, standard pattern is: index = id.y * grid_width + id.x
    // I will add grid_dimensions to Uniforms struct to be correct.
    
    let cell_width = 10.0;
    let cell_height = 20.0;
    let grid_w = u32(ceil(params.resolution.x / cell_width));
    
    let index = id.y * grid_w + id.x;
    
    // Boundary check
    let grid_h = u32(ceil(params.resolution.y / cell_height));
    if (id.x >= grid_w || id.y >= grid_h) {
        return;
    }

    // Normalized UV for the cell center
    let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(f32(grid_w), f32(grid_h));
    
    // --- Raymarch & Signal Logic ---
    
    // Camera / Ray setup
    // Aspect ratio correction
    let aspect = params.resolution.x / params.resolution.y;
    var p_uv = uv * 2.0 - 1.0;
    p_uv.x *= aspect;
    
    var pos = vec3<f32>(p_uv, -2.0);
    var dir = normalize(vec3<f32>(p_uv, 1.0));
    
    // Temporal Distortion
    let t = params.time * 0.5 + params.audio * 2.0; // Speed up with audio
    
    // Rotate camera based on mouse
    // let m = params.mouse / params.resolution * 2.0 - 1.0;
    // pos.xz *= rot2d(m.x);
    // dir.xz *= rot2d(m.x);
    
    // Simple Raymarch (few steps for performance)
    var d_total = 0.0;
    var min_d = 1000.0;
    var hit = false;
    
    for (var i = 0; i < 16; i++) {
        var p = pos + dir * d_total;
        
        // Twist space
        p.x += sin(t + p.y * 2.0) * 0.2;
        p.z += cos(t * 0.7 + p.x * 1.5) * 0.2;
        
        // Rotate object
        var p_rot = p;
        p_rot.xy = rot2d(t * 0.2) * p_rot.xy;
        p_rot.xz = rot2d(t * 0.3) * p_rot.xz;

        let d = sdOctahedron(p_rot, 0.8 + params.audio * 0.2); // Pulse size
        
        min_d = min(min_d, d); // Keep track of closest approach (glow)
        d_total += d;
        
        if (d < 0.01) {
            hit = true;
            break;
        }
        if (d_total > 5.0) {
            break;
        }
    }
    
    // --- Map to ASCII & Color ---
    
    var intensity = 0.0;
    
    // Plan Formula: S(x,y,t) = sin(x*f1 + t) + sin(y*f2 - t) + sin((x+y)*f3)
    let f1 = 10.0;
    let f2 = 8.0;
    let f3 = 13.0; // Prime frequency
    
    let interference = sin(uv.x * f1 + t) + sin(uv.y * f2 - t) + sin((uv.x + uv.y) * f3);
    // Normalize interference (-3 to 3 -> 0 to 1 approx)
    let signal = (interference + 3.0) / 6.0;
    
    if (hit) {
        intensity = 1.0 / (1.0 + d_total * 0.5); // Depth fade
        // Combine object with interference
        intensity = max(intensity, signal * 0.5);
    } else {
        // Glow based on min_d
        let glow = 0.05 / (0.05 + min_d * min_d * 10.0);
        intensity = max(glow, signal * 0.3); // Background signal
    }
    
    // Add Audio Pulse
    intensity += params.audio * 0.3;
    
    // Exponential curve for Void aesthetic (mostly empty)
    intensity = pow(intensity, 3.0); // Sharper cutoff for more void
    
    // 64 chars in glyph set
    let char_index = u32(clamp(intensity * 64.0, 0.0, 63.0));
    
    // Color Grading: Void (0.05 0 0) -> Biolum (0.99 0 0)
    // Void Surface (0.14 0 0) for faint signal
    // Biolum Dim (0.70 0 0) for medium
    // Biolum (0.99 0 0) for peak
    
    let l = 0.05 + intensity * (0.99 - 0.05);
    // Keep it grayscale (C=0) as per design system for this effect
    // Or maybe slight hint of blue/cyan if desired, but "Signal in Void" usually white/red/monochrome.
    // Plan says Biolum 0.99 0 0 (White).
    
    let c = l; 
    
    let r = u32(c * 255.0);
    let g = u32(c * 255.0);
    let b = u32(c * 255.0);
    
    // Pack: Char (8) | R (8) | G (8) | B (8)
    let packed = (char_index << 24) | (r << 16) | (g << 8) | b;
    
    grid[index].packed_data = packed;
}
