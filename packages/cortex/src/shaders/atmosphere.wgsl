// Atmospheric Layer - Radial Fog and Fiber Texture
// Creates depth and atmosphere around the central orb

const TAU: f32 = 6.283185307179586;
const PI: f32 = 3.141592653589793;

struct Uniforms {
  time: f32,
  delta_time: f32,
  resolution: vec2f,
  mouse: vec2f,
  orb_center: vec2f,
  orb_state: f32,
  audio_low: f32,
  audio_mid: f32,
  zoom: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Simplex noise helpers
fn mod289_3(x: vec3f) -> vec3f {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_2(x: vec2f) -> vec2f {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec3f) -> vec3f {
  return mod289_3(((x * 34.0) + 1.0) * x);
}

fn simplex_noise_2d(v: vec2f) -> f32 {
  let C = vec4f(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  
  var i = floor(v + dot(v, vec2f(C.y)));
  let x0 = v - i + dot(i, vec2f(C.x));
  
  var i1: vec2f;
  if (x0.x > x0.y) {
    i1 = vec2f(1.0, 0.0);
  } else {
    i1 = vec2f(0.0, 1.0);
  }
  
  var x12 = x0.xyxy + vec4f(C.x, C.x, C.z, C.z);
  x12 = vec4f(x12.xy - i1, x12.zw);
  
  i = mod289_2(i);
  let p = permute(permute(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
  
  var m = max(vec3f(0.5) - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
  m = m * m;
  m = m * m;
  
  let x = 2.0 * fract(p * C.w) - 1.0;
  let h = abs(x) - 0.5;
  let ox = floor(x + 0.5);
  let a0 = x - ox;
  
  m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));
  
  let g = vec3f(
    a0.x * x0.x + h.x * x0.y,
    a0.y * x12.x + h.y * x12.y,
    a0.z * x12.z + h.z * x12.w
  );
  
  return 130.0 * dot(m, g);
}

// FBM for fiber texture
fn fbm(p: vec2f, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 1.0;
  var frequency = 1.0;
  var max_value = 0.0;
  
  for (var i = 0; i < octaves; i++) {
    value += amplitude * simplex_noise_2d(p * frequency);
    max_value += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value / max_value;
}

// Full-screen quad vertex shader
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_pos: vec2f,
}

@vertex
fn vs_atmosphere(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  // Full-screen triangle (oversized to cover screen)
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  
  let pos = positions[vertex_index];
  
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = (pos + 1.0) * 0.5;
  output.uv.y = 1.0 - output.uv.y;
  output.world_pos = output.uv * uniforms.resolution;
  
  return output;
}

@fragment
fn fs_atmosphere(input: VertexOutput) -> @location(0) vec4f {
  // Distance from orb center
  let to_orb = input.world_pos - uniforms.orb_center;
  let dist_from_orb = length(to_orb);
  
  // Fog configuration
  let fog_inner_radius = 200.0;
  let fog_outer_radius = 600.0;
  
  // Radial fog gradient
  let fog_t = clamp((dist_from_orb - fog_inner_radius) / (fog_outer_radius - fog_inner_radius), 0.0, 1.0);
  let fog_density = (1.0 - fog_t) * 0.15;
  
  // Teal fog color with subtle variation
  let fog_hue_shift = simplex_noise_2d(input.world_pos * 0.001 + uniforms.time * 0.02) * 0.1;
  let fog_color = vec3f(0.0, 0.9 + fog_hue_shift, 0.8 - fog_hue_shift);
  
  // Fiber texture using FBM
  let fiber_scale = 0.005;
  let fiber_time = uniforms.time * 0.01;
  let fiber_uv = input.world_pos * fiber_scale;
  
  // Multiple fiber layers at different scales
  let fiber1 = fbm(fiber_uv + vec2f(fiber_time, 0.0), 4);
  let fiber2 = fbm(fiber_uv * 2.0 + vec2f(0.0, fiber_time * 0.5), 3);
  let fiber3 = fbm(fiber_uv * 0.5 + vec2f(-fiber_time * 0.2, fiber_time * 0.3), 5);
  
  // Combine fibers with decreasing intensity toward edges
  let fiber_falloff = 1.0 - smoothstep(0.0, 800.0, dist_from_orb);
  let fiber_intensity = (fiber1 * 0.5 + fiber2 * 0.3 + fiber3 * 0.2) * fiber_falloff * 0.08;
  let fiber_color = vec3f(1.0) * max(0.0, fiber_intensity);
  
  // Orb state affects atmosphere intensity
  // 0 = dormant (dim), 4 = processing (bright)
  let state_intensity = mix(0.5, 1.2, uniforms.orb_state / 4.0);
  
  // Audio reactivity - bass pulses the fog
  let audio_pulse = 1.0 + uniforms.audio_low * 0.3;
  
  // Vignette effect (darker at edges)
  let screen_center = uniforms.resolution * 0.5;
  let to_center = input.world_pos - screen_center;
  let vignette_dist = length(to_center) / length(screen_center);
  let vignette = 1.0 - smoothstep(0.5, 1.2, vignette_dist) * 0.5;
  
  // Combine all effects
  let fog_contribution = fog_color * fog_density * state_intensity * audio_pulse;
  let fiber_contribution = fiber_color;
  
  let final_color = (fog_contribution + fiber_contribution) * vignette;
  let final_alpha = (fog_density + fiber_intensity) * vignette;
  
  // Subtle noise dither to prevent banding
  let dither = (simplex_noise_2d(input.world_pos) * 0.5 + 0.5) * 0.005;
  
  return vec4f(final_color + dither, final_alpha * 0.8);
}

// Depth-based atmosphere (for layered rendering)
@fragment
fn fs_atmosphere_depth(input: VertexOutput) -> @location(0) vec4f {
  let to_orb = input.world_pos - uniforms.orb_center;
  let dist_from_orb = length(to_orb);
  
  // Depth layers (back to front)
  // Layer 0: Deep background
  // Layer 1: Mid atmosphere
  // Layer 2: Near atmosphere
  
  // Deep background - subtle radial gradient
  let deep_t = smoothstep(800.0, 200.0, dist_from_orb);
  let deep_color = vec3f(0.02, 0.03, 0.04) * deep_t;
  
  // Ocean-like caustics in deep layer
  let caustic_scale = 0.003;
  let caustic_time = uniforms.time * 0.05;
  let caustic1 = simplex_noise_2d(input.world_pos * caustic_scale + vec2f(caustic_time, 0.0));
  let caustic2 = simplex_noise_2d(input.world_pos * caustic_scale * 1.3 + vec2f(0.0, -caustic_time * 0.7));
  let caustic = max(0.0, caustic1 + caustic2) * 0.03 * deep_t;
  
  let final_color = deep_color + vec3f(0.0, 0.5, 0.4) * caustic;
  
  return vec4f(final_color, 0.5);
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
