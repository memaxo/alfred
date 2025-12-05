// Corona Fiber System - Logarithmic Spiral Renderer
// 2000 fibers spiraling into the central orb

const TAU: f32 = 6.283185307179586;
const PI: f32 = 3.141592653589793;

// Configuration
const FIBER_COUNT: u32 = 2000u;
const SEGMENTS_PER_FIBER: u32 = 50u;
const INNER_RADIUS: f32 = 150.0;
const OUTER_RADIUS: f32 = 400.0;
const SPIRAL_TIGHTNESS: f32 = 0.15;
const ROTATION_SPEED: f32 = 0.10472; // TAU / 60 seconds

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

// Fiber segment data
struct FiberSegment {
  position: vec2f,
  alpha: f32,
  width: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> fibers: array<FiberSegment>;

// Simplex noise for organic wobble
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

@compute @workgroup_size(256)
fn update_fibers(@builtin(global_invocation_id) id: vec3u) {
  let fiber_id = id.x / SEGMENTS_PER_FIBER;
  let segment_id = id.x % SEGMENTS_PER_FIBER;
  
  if (fiber_id >= FIBER_COUNT) {
    return;
  }
  
  let segment_t = f32(segment_id) / f32(SEGMENTS_PER_FIBER);
  
  // Base angle for this fiber (evenly distributed around circle)
  let base_angle = (f32(fiber_id) / f32(FIBER_COUNT)) * TAU;
  
  // Rotation over time
  let rotation = uniforms.time * ROTATION_SPEED;
  
  // Logarithmic spiral: r(θ) = outer * e^(-tightness * θ)
  // Maps segment_t [0,1] to radius [outer, inner]
  let spiral_factor = exp(-SPIRAL_TIGHTNESS * segment_t * TAU * 4.0);
  var r = OUTER_RADIUS * spiral_factor;
  r = max(r, INNER_RADIUS);
  
  // Angular position along spiral
  let theta = base_angle + rotation + segment_t * TAU * 4.0;
  
  // Organic wobble using simplex noise
  // Amplitude decreases toward center for stability
  let wobble_amplitude = 0.15 * (1.0 - segment_t);
  let wobble_input = vec2f(f32(fiber_id) * 0.1, segment_t * 10.0 + uniforms.time * 0.5);
  let wobble = simplex_noise_2d(wobble_input) * wobble_amplitude;
  
  // Audio reactivity - bass pulses the fibers
  let audio_pulse = 1.0 + uniforms.audio_low * 0.3 * (1.0 - segment_t);
  
  // Orb state affects intensity
  // dormant(0) = dim, active(3) = bright
  let state_intensity = mix(0.3, 1.0, uniforms.orb_state / 4.0);
  
  // Final position
  let final_theta = theta + wobble;
  let final_r = r * audio_pulse;
  
  let pos = uniforms.orb_center + vec2f(
    cos(final_theta) * final_r,
    sin(final_theta) * final_r
  );
  
  // Alpha fades toward outer edge and toward center
  let edge_fade = smoothstep(0.0, 0.1, segment_t) * smoothstep(1.0, 0.9, segment_t);
  let alpha = edge_fade * state_intensity;
  
  // Width thins toward center
  let width = mix(2.0, 0.5, segment_t);
  
  let index = id.x;
  fibers[index].position = pos;
  fibers[index].alpha = alpha;
  fibers[index].width = width;
}

// Vertex output for fiber rendering
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) alpha: f32,
  @location(1) uv: vec2f,
}

@vertex
fn vs_fiber(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  // Each fiber segment is a quad connecting two points
  let fiber_id = instance_index / (SEGMENTS_PER_FIBER - 1u);
  let segment_id = instance_index % (SEGMENTS_PER_FIBER - 1u);
  
  let idx0 = fiber_id * SEGMENTS_PER_FIBER + segment_id;
  let idx1 = idx0 + 1u;
  
  let seg0 = fibers[idx0];
  let seg1 = fibers[idx1];
  
  // Direction and normal
  let dir = normalize(seg1.position - seg0.position);
  let normal = vec2f(-dir.y, dir.x);
  
  // Quad vertices
  var corners = array<vec2f, 6>(
    vec2f(0.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(0.0,  1.0),
    vec2f(0.0,  1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0,  1.0),
  );
  
  let corner = corners[vertex_index];
  let t = corner.x;
  let side = corner.y;
  
  // Interpolate position and width
  let pos = mix(seg0.position, seg1.position, t);
  let width = mix(seg0.width, seg1.width, t);
  let alpha = mix(seg0.alpha, seg1.alpha, t);
  
  let world_pos = pos + normal * side * width;
  
  // Transform to clip space
  let clip_pos = vec2f(
    (world_pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (world_pos.y / uniforms.resolution.y) * 2.0
  );
  
  var output: VertexOutput;
  output.position = vec4f(clip_pos, 0.0, 1.0);
  output.alpha = alpha;
  output.uv = vec2f(t, side * 0.5 + 0.5);
  
  return output;
}

@fragment
fn fs_fiber(input: VertexOutput) -> @location(0) vec4f {
  // Soft edges perpendicular to fiber direction
  let edge_softness = 1.0 - pow(abs(input.uv.y - 0.5) * 2.0, 2.0);
  
  // Teal color with white core
  let core_intensity = pow(edge_softness, 4.0);
  let color = mix(
    vec3f(0.0, 0.9, 0.8), // Teal
    vec3f(1.0, 1.0, 1.0), // White core
    core_intensity * 0.3
  );
  
  let final_alpha = input.alpha * edge_softness * 0.6;
  
  return vec4f(color, final_alpha);
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
