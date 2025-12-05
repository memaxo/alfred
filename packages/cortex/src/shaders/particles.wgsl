// Gravitational Particle System Compute Shader
// Particles orbit and spiral toward the central orb

// Import common utilities (bundled at compile time)
// const TAU, PI, simplex_noise_2d, etc. from common.wgsl

const TAU: f32 = 6.283185307179586;

// Particle structure - Struct of Arrays for cache efficiency
struct Particle {
  position: vec2f,
  velocity: vec2f,
  life: f32,
  size: f32,
  _pad: vec2f, // Align to 32 bytes
}

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

// Physics constants
const G: f32 = 5000.0;           // Gravitational constant
const ORB_MASS: f32 = 100.0;     // Mass of central orb
const DAMPING: f32 = 0.998;      // Velocity damping
const MIN_DIST: f32 = 50.0;      // Event horizon (prevent singularity)
const SPAWN_RADIUS: f32 = 800.0; // Spawn at edge radius

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particles_in: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particles_out: array<Particle>;

// Hash for deterministic randomness
fn hash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn hash2(p: vec2f) -> vec2f {
  let n = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(n) * 43758.5453123);
}

// Respawn particle at frame edge
fn respawn_at_edge(id: u32) -> Particle {
  let seed = vec2f(f32(id), uniforms.time * 0.1);
  let angle = hash(seed) * TAU;
  let radius = SPAWN_RADIUS + hash(seed + vec2f(1.0, 0.0)) * 200.0;
  
  let pos = uniforms.orb_center + vec2f(cos(angle), sin(angle)) * radius;
  
  // Initial velocity tangent to orbit with slight inward bias
  let to_orb = normalize(uniforms.orb_center - pos);
  let tangent = vec2f(-to_orb.y, to_orb.x);
  let orbital_speed = sqrt(G * ORB_MASS / radius);
  let vel = tangent * orbital_speed * 0.8 + to_orb * orbital_speed * 0.2;
  
  var p: Particle;
  p.position = pos;
  p.velocity = vel;
  p.life = 1.0 + hash(seed + vec2f(2.0, 0.0)) * 0.5;
  p.size = 1.0 + hash(seed + vec2f(3.0, 0.0)) * 2.0;
  p._pad = vec2f(0.0);
  
  return p;
}

@compute @workgroup_size(256)
fn update_particles(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&particles_in)) {
    return;
  }
  
  var p = particles_in[index];
  
  // Vector to orb center
  let to_orb = uniforms.orb_center - p.position;
  let distance = length(to_orb);
  
  // Check if particle should respawn
  if (distance < MIN_DIST || p.life <= 0.0) {
    particles_out[index] = respawn_at_edge(index);
    return;
  }
  
  let direction = to_orb / distance;
  
  // Gravitational force: F = G * M / r²
  let effective_dist = max(distance, MIN_DIST);
  let force = G * ORB_MASS / (effective_dist * effective_dist);
  
  // Orb state influences attraction
  // 0 = dormant (weak), 1 = idle, 2 = listening, 3 = active, 4 = processing (strong)
  let state_multiplier = mix(0.5, 2.0, uniforms.orb_state / 4.0);
  
  // Audio reactivity - bass increases attraction
  let audio_multiplier = 1.0 + uniforms.audio_low * 0.5;
  
  // Apply acceleration
  let acceleration = direction * force * state_multiplier * audio_multiplier;
  p.velocity += acceleration * uniforms.delta_time;
  
  // Apply damping
  p.velocity *= DAMPING;
  
  // Update position
  p.position += p.velocity * uniforms.delta_time;
  
  // Decay life
  p.life -= uniforms.delta_time * 0.1;
  
  // Pulse size with audio
  p.size = (1.0 + uniforms.audio_mid * 2.0) * (0.5 + p.life * 0.5);
  
  particles_out[index] = p;
}

// Vertex output for particle rendering
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) life: f32,
  @location(2) size: f32,
}

@vertex
fn vs_particle(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let p = particles_in[instance_index];
  
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
  let world_pos = p.position + corner * p.size * 3.0;
  
  // Transform to clip space
  let clip_pos = vec2f(
    (world_pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (world_pos.y / uniforms.resolution.y) * 2.0
  );
  
  var output: VertexOutput;
  output.position = vec4f(clip_pos, 0.0, 1.0);
  output.uv = corner * 0.5 + 0.5;
  output.life = p.life;
  output.size = p.size;
  
  return output;
}

@fragment
fn fs_particle(input: VertexOutput) -> @location(0) vec4f {
  // Circular particle with soft edges
  let dist = length(input.uv - vec2f(0.5));
  let alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  // Color based on life and proximity to orb
  let color = mix(
    vec3f(0.0, 0.9, 0.8),  // Teal (alive)
    vec3f(1.0, 1.0, 1.0),  // White (dying/close)
    1.0 - input.life
  );
  
  // Fade with life
  let final_alpha = alpha * input.life * 0.6;
  
  return vec4f(color, final_alpha);
}
