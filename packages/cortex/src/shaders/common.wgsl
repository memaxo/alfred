// Common WGSL utilities shared across all shaders

// Mathematical constants
const TAU: f32 = 6.283185307179586;
const PI: f32 = 3.141592653589793;
const PHI: f32 = 1.618033988749895;
const GOLDEN_ANGLE: f32 = 2.399963229728653; // PI * (3 - sqrt(5))

// Global uniforms structure - must match TypeScript layout
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
  _pad: vec2f, // Padding to 64 bytes
}

// Color palette from design system
const COLOR_VOID: vec3f = vec3f(0.05, 0.05, 0.05);
const COLOR_TEAL: vec3f = vec3f(0.0, 0.9, 0.8);
const COLOR_CYAN: vec3f = vec3f(0.0, 0.83, 0.93);
const COLOR_WHITE: vec3f = vec3f(1.0, 1.0, 1.0);
const COLOR_AMBER: vec3f = vec3f(1.0, 0.6, 0.2);

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

// 2D Simplex noise
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

// Fractal Brownian Motion
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

// Smooth step
fn smooth_step(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Signed distance to circle
fn sdf_circle(p: vec2f, center: vec2f, radius: f32) -> f32 {
  return length(p - center) - radius;
}

// Glow falloff from SDF
fn glow_from_sdf(d: f32, falloff: f32, intensity: f32) -> f32 {
  return exp(-max(d, 0.0) * falloff) * intensity;
}

// Hash for randomness
fn hash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn hash2(p: vec2f) -> vec2f {
  let n = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(n) * 43758.5453123);
}

// Rotate 2D point
fn rotate2d(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Remap value from one range to another
fn remap(value: f32, low1: f32, high1: f32, low2: f32, high2: f32) -> f32 {
  return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
}
