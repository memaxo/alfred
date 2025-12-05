// Living Edge System - Bezier Particle Streams
// Particles flow along curved paths between nodes

const TAU: f32 = 6.283185307179586;

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

// Edge definition (bezier curve + metadata)
struct Edge {
  p0: vec2f,     // Start point
  p1: vec2f,     // Control point 1
  p2: vec2f,     // Control point 2
  p3: vec2f,     // End point
  active: f32,   // 0 = dormant, 1 = active
  color_r: f32,
  color_g: f32,
  color_b: f32,
}

// Particle on an edge
struct EdgeParticle {
  t: f32,        // Position along curve [0, 1]
  speed: f32,    // Movement speed
  offset: f32,   // Perpendicular offset
  size: f32,     // Particle size
  world_pos: vec2f, // Computed world position
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> edges: array<Edge>;
@group(0) @binding(2) var<storage, read_write> particles: array<EdgeParticle>;

// Particle counts
const PARTICLES_PER_EDGE: u32 = 200u;

// Cubic bezier evaluation
fn cubic_bezier(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let mt = 1.0 - t;
  let mt2 = mt * mt;
  let mt3 = mt2 * mt;
  let t2 = t * t;
  let t3 = t2 * t;
  return mt3 * p0 + 3.0 * mt2 * t * p1 + 3.0 * mt * t2 * p2 + t3 * p3;
}

// Bezier tangent (derivative)
fn bezier_tangent(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let mt = 1.0 - t;
  let mt2 = mt * mt;
  let t2 = t * t;
  return 3.0 * mt2 * (p1 - p0) + 6.0 * mt * t * (p2 - p1) + 3.0 * t2 * (p3 - p2);
}

// Hash for deterministic randomness
fn hash(p: f32) -> f32 {
  return fract(sin(p * 127.1) * 43758.5453123);
}

@compute @workgroup_size(64)
fn update_edge_particles(@builtin(global_invocation_id) id: vec3u) {
  let edge_id = id.x / PARTICLES_PER_EDGE;
  let particle_id = id.x % PARTICLES_PER_EDGE;
  
  if (edge_id >= arrayLength(&edges)) {
    return;
  }
  
  let edge = edges[edge_id];
  let particle_index = id.x;
  var p = particles[particle_index];
  
  // Active edges have flowing particles
  if (edge.active > 0.5) {
    // Update position along curve
    p.t += p.speed * uniforms.delta_time;
    
    // Wrap around
    if (p.t > 1.0) {
      p.t -= 1.0;
      // Randomize offset on respawn
      p.offset = (hash(f32(particle_index) + uniforms.time) - 0.5) * 4.0;
    }
    
    // Audio reactivity - bass speeds up flow
    let audio_speed = 1.0 + uniforms.audio_low * 0.5;
    p.t += p.speed * uniforms.delta_time * audio_speed;
    
    // Compute position on curve
    let curve_pos = cubic_bezier(edge.p0, edge.p1, edge.p2, edge.p3, p.t);
    
    // Compute perpendicular offset
    let tangent = bezier_tangent(edge.p0, edge.p1, edge.p2, edge.p3, p.t);
    let len = length(tangent);
    var normal = vec2f(0.0, 1.0);
    if (len > 0.001) {
      normal = vec2f(-tangent.y, tangent.x) / len;
    }
    
    // Add wobble to offset
    let wobble = sin(p.t * TAU * 3.0 + uniforms.time * 2.0) * 1.5;
    
    p.world_pos = curve_pos + normal * (p.offset + wobble);
    
    // Size pulses with audio
    p.size = (1.0 + uniforms.audio_mid * 1.5) * mix(0.5, 1.5, p.t);
  } else {
    // Dormant edges - particles drift slowly
    p.t += p.speed * uniforms.delta_time * 0.1;
    if (p.t > 1.0) { p.t -= 1.0; }
    
    let curve_pos = cubic_bezier(edge.p0, edge.p1, edge.p2, edge.p3, p.t);
    p.world_pos = curve_pos;
    p.size = 0.5;
  }
  
  particles[particle_index] = p;
}

// Initialize particles (called once on setup)
@compute @workgroup_size(64)
fn init_edge_particles(@builtin(global_invocation_id) id: vec3u) {
  let edge_id = id.x / PARTICLES_PER_EDGE;
  let particle_id = id.x % PARTICLES_PER_EDGE;
  
  if (edge_id >= arrayLength(&edges)) {
    return;
  }
  
  let particle_index = id.x;
  let seed = f32(particle_index);
  
  var p: EdgeParticle;
  p.t = hash(seed);
  p.speed = 0.1 + hash(seed + 1.0) * 0.2;
  p.offset = (hash(seed + 2.0) - 0.5) * 4.0;
  p.size = 0.5 + hash(seed + 3.0) * 1.0;
  p.world_pos = vec2f(0.0);
  p._pad = vec2f(0.0);
  
  particles[particle_index] = p;
}

// Vertex output for edge particle rendering
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) alpha: f32,
}

@vertex
fn vs_edge_particle(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let edge_id = instance_index / PARTICLES_PER_EDGE;
  let edge = edges[edge_id];
  let p = particles[instance_index];
  
  // Quad vertices
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
  );
  
  let corner = corners[vertex_index];
  let world_pos = p.world_pos + corner * p.size * 2.0;
  
  // Transform to clip space
  let clip_pos = vec2f(
    (world_pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (world_pos.y / uniforms.resolution.y) * 2.0
  );
  
  // Alpha based on activity and position along curve
  let edge_fade = smoothstep(0.0, 0.1, p.t) * smoothstep(1.0, 0.9, p.t);
  let activity_alpha = mix(0.1, 0.8, edge.active);
  
  var output: VertexOutput;
  output.position = vec4f(clip_pos, 0.0, 1.0);
  output.uv = corner * 0.5 + 0.5;
  output.color = vec3f(edge.color_r, edge.color_g, edge.color_b);
  output.alpha = edge_fade * activity_alpha;
  
  return output;
}

@fragment
fn fs_edge_particle(input: VertexOutput) -> @location(0) vec4f {
  // Circular particle with soft edges
  let dist = length(input.uv - vec2f(0.5));
  let alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  let final_alpha = alpha * input.alpha;
  
  return vec4f(input.color, final_alpha);
}

// Base edge line rendering (for dormant edges)
struct EdgeLineVertex {
  @builtin(position) position: vec4f,
  @location(0) t: f32,
  @location(1) alpha: f32,
}

@vertex
fn vs_edge_line(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> EdgeLineVertex {
  let edge = edges[instance_index];
  
  // Sample points along bezier
  const SEGMENTS: u32 = 32u;
  let segment_id = vertex_index / 6u;
  let quad_vertex = vertex_index % 6u;
  
  let t0 = f32(segment_id) / f32(SEGMENTS);
  let t1 = f32(segment_id + 1u) / f32(SEGMENTS);
  
  let pos0 = cubic_bezier(edge.p0, edge.p1, edge.p2, edge.p3, t0);
  let pos1 = cubic_bezier(edge.p0, edge.p1, edge.p2, edge.p3, t1);
  
  let dir = normalize(pos1 - pos0);
  let normal = vec2f(-dir.y, dir.x);
  let width = mix(1.0, 2.0, edge.active);
  
  var quad_offsets = array<vec4f, 6>(
    vec4f(0.0, -1.0, t0, 0.0),
    vec4f(1.0, -1.0, t1, 0.0),
    vec4f(0.0,  1.0, t0, 1.0),
    vec4f(0.0,  1.0, t0, 1.0),
    vec4f(1.0, -1.0, t1, 0.0),
    vec4f(1.0,  1.0, t1, 1.0),
  );
  
  let offset = quad_offsets[quad_vertex];
  let pos = mix(pos0, pos1, offset.x) + normal * offset.y * width;
  
  let clip_pos = vec2f(
    (pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / uniforms.resolution.y) * 2.0
  );
  
  var output: EdgeLineVertex;
  output.position = vec4f(clip_pos, 0.0, 1.0);
  output.t = offset.z;
  output.alpha = mix(0.2, 0.6, edge.active);
  
  return output;
}

@fragment
fn fs_edge_line(input: EdgeLineVertex) -> @location(0) vec4f {
  // Soft edge fade
  let edge_fade = smoothstep(0.0, 0.1, input.t) * smoothstep(1.0, 0.9, input.t);
  let color = vec3f(0.0, 0.9, 0.8); // Teal
  
  return vec4f(color, input.alpha * edge_fade);
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
