// Node Renderer - SDF-based Circular Neurons
// Renders satellite nodes with ring strokes, inner/outer glow, and activity pulsing

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

// Node data
struct Node {
  position: vec2f,
  radius: f32,
  activity: f32,     // 0 = idle, 1 = focused
  color_r: f32,
  color_g: f32,
  color_b: f32,
  node_type: f32,    // 0 = memory, 1 = action, 2 = insight, etc.
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;

// SDF for circle
fn sdf_circle(p: vec2f, center: vec2f, radius: f32) -> f32 {
  return length(p - center) - radius;
}

// Glow falloff from SDF
fn glow_from_sdf(d: f32, falloff: f32, intensity: f32) -> f32 {
  return exp(-max(d, 0.0) * falloff) * intensity;
}

// Smooth step
fn smooth_step(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Vertex output
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local_uv: vec2f,    // UV relative to node center
  @location(1) @interpolate(flat) node_idx: u32,
}

@vertex
fn vs_node(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let node = nodes[instance_index];
  
  // Expand quad to cover node + glow
  let glow_extend = mix(80.0, 150.0, node.activity);
  let quad_size = node.radius + glow_extend;
  
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
  let world_pos = node.position + corner * quad_size;
  
  // Transform to clip space
  let clip_pos = vec2f(
    (world_pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (world_pos.y / uniforms.resolution.y) * 2.0
  );
  
  var output: VertexOutput;
  output.position = vec4f(clip_pos, 0.0, 1.0);
  output.local_uv = corner * quad_size; // UV in world units from node center
  output.node_idx = instance_index;
  
  return output;
}

@fragment
fn fs_node(input: VertexOutput) -> @location(0) vec4f {
  let node = nodes[input.node_idx];
  
  // SDF to node boundary
  let d = length(input.local_uv) - node.radius;
  
  // Ring stroke
  let ring_width = 2.0;
  let ring = smooth_step(ring_width, 0.0, abs(d));
  
  // Inner glow (inside the circle)
  let inner_intensity = mix(0.2, 0.4, node.activity);
  let inner_falloff = 0.02;
  let inner_glow = glow_from_sdf(-d, inner_falloff, inner_intensity) * step(d, 0.0);
  
  // Outer glow (outside the circle)
  let outer_intensity = mix(0.15, 0.5, node.activity);
  let outer_falloff = mix(0.05, 0.02, node.activity);
  let outer_glow = glow_from_sdf(d, outer_falloff, outer_intensity);
  
  // Activity pulse
  let pulse = sin(uniforms.time * 3.0 + f32(input.node_idx) * 0.5) * 0.5 + 0.5;
  let activity_boost = node.activity * pulse * 0.3;
  
  // Audio reactivity
  let audio_boost = uniforms.audio_mid * 0.2 * node.activity;
  
  // Combine
  let brightness = ring + inner_glow + outer_glow + activity_boost + audio_boost;
  
  // Color
  let node_color = vec3f(node.color_r, node.color_g, node.color_b);
  
  // White core for active nodes
  let core_factor = inner_glow * node.activity * 2.0;
  let final_color = mix(node_color, vec3f(1.0), core_factor);
  
  // Final alpha
  let alpha = clamp(brightness, 0.0, 1.0);
  
  // Discard nearly transparent fragments
  if (alpha < 0.01) {
    discard;
  }
  
  return vec4f(final_color * brightness, alpha);
}

// Focused node has additional pulsing ring
@fragment
fn fs_node_focused(input: VertexOutput) -> @location(0) vec4f {
  let node = nodes[input.node_idx];
  
  if (node.activity < 0.5) {
    // Not focused, use standard rendering
    return fs_node(input);
  }
  
  let d = length(input.local_uv) - node.radius;
  
  // Animated expanding ring
  let ring_time = fract(uniforms.time * 0.5);
  let ring_radius = node.radius + ring_time * 100.0;
  let expanding_d = length(input.local_uv) - ring_radius;
  let expanding_ring = smooth_step(3.0, 0.0, abs(expanding_d)) * (1.0 - ring_time);
  
  // Standard node rendering
  let ring_width = 2.5;
  let ring = smooth_step(ring_width, 0.0, abs(d));
  
  let inner_glow = glow_from_sdf(-d, 0.015, 0.5) * step(d, 0.0);
  let outer_glow = glow_from_sdf(d, 0.015, 0.6);
  
  let brightness = ring + inner_glow + outer_glow + expanding_ring * 0.5;
  
  let node_color = vec3f(node.color_r, node.color_g, node.color_b);
  let final_color = mix(node_color, vec3f(1.0), inner_glow * 0.5);
  
  let alpha = clamp(brightness, 0.0, 1.0);
  
  if (alpha < 0.01) {
    discard;
  }
  
  return vec4f(final_color * brightness, alpha);
}

// Icon rendering for node types (simplified - just renders a symbol)
@fragment
fn fs_node_icon(input: VertexOutput) -> @location(0) vec4f {
  let node = nodes[input.node_idx];
  
  // Only draw icon inside node
  let d = length(input.local_uv) - node.radius * 0.6;
  if (d > 0.0) {
    discard;
  }
  
  // Simple shape based on node type
  var icon_alpha = 0.0;
  let uv = input.local_uv / (node.radius * 0.6);
  
  let node_type = u32(node.node_type);
  
  switch (node_type) {
    case 0u: {
      // Memory - circle
      icon_alpha = 1.0 - smooth_step(0.3, 0.4, length(uv));
    }
    case 1u: {
      // Action - triangle
      let tri_d = max(
        max(uv.x * 0.866 + uv.y * 0.5, -uv.y),
        -uv.x * 0.866 + uv.y * 0.5
      ) - 0.4;
      icon_alpha = 1.0 - smooth_step(0.0, 0.05, tri_d);
    }
    case 2u: {
      // Insight - star/diamond
      let star_d = abs(uv.x) + abs(uv.y) - 0.5;
      icon_alpha = 1.0 - smooth_step(0.0, 0.05, star_d);
    }
    default: {
      // Default - small dot
      icon_alpha = 1.0 - smooth_step(0.1, 0.15, length(uv));
    }
  }
  
  let icon_color = vec3f(1.0) * icon_alpha * 0.4;
  
  if (icon_alpha < 0.01) {
    discard;
  }
  
  return vec4f(icon_color, icon_alpha * 0.3);
}
