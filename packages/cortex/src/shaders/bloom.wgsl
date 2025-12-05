// Post-Processing: Bloom Effect
// Multi-pass separable Gaussian blur with threshold extraction

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

struct BloomParams {
  threshold: f32,
  intensity: f32,
  blur_radius: f32,
  _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> bloom_params: BloomParams;
@group(0) @binding(2) var scene_texture: texture_2d<f32>;
@group(0) @binding(3) var bloom_texture: texture_2d<f32>;
@group(0) @binding(4) var linear_sampler: sampler;

// Gaussian blur weights for 5-tap kernel
const BLUR_WEIGHTS: array<f32, 5> = array(0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
const BLUR_OFFSETS: array<f32, 5> = array(0.0, 1.0, 2.0, 3.0, 4.0);

// Full-screen quad vertex shader
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_fullscreen(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
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
  
  return output;
}

// Bloom extraction - extract bright areas
@fragment
fn fs_bloom_extract(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(scene_texture, linear_sampler, input.uv);
  
  // Luminance calculation
  let luma = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
  
  // Soft threshold
  let threshold = bloom_params.threshold;
  let knee = threshold * 0.5;
  let soft = luma - threshold + knee;
  let soft_clamped = clamp(soft, 0.0, 2.0 * knee);
  let soft_factor = soft_clamped * soft_clamped / (4.0 * knee + 0.0001);
  
  let contribution = max(soft_factor, luma - threshold) / max(luma, 0.0001);
  
  return vec4f(color.rgb * contribution, 1.0);
}

// Horizontal Gaussian blur
@fragment
fn fs_blur_horizontal(input: VertexOutput) -> @location(0) vec4f {
  let texel_size = 1.0 / uniforms.resolution.x;
  var result = textureSample(bloom_texture, linear_sampler, input.uv).rgb * BLUR_WEIGHTS[0];
  
  for (var i = 1; i < 5; i++) {
    let offset = texel_size * BLUR_OFFSETS[i] * bloom_params.blur_radius;
    result += textureSample(bloom_texture, linear_sampler, input.uv + vec2f(offset, 0.0)).rgb * BLUR_WEIGHTS[i];
    result += textureSample(bloom_texture, linear_sampler, input.uv - vec2f(offset, 0.0)).rgb * BLUR_WEIGHTS[i];
  }
  
  return vec4f(result, 1.0);
}

// Vertical Gaussian blur
@fragment
fn fs_blur_vertical(input: VertexOutput) -> @location(0) vec4f {
  let texel_size = 1.0 / uniforms.resolution.y;
  var result = textureSample(bloom_texture, linear_sampler, input.uv).rgb * BLUR_WEIGHTS[0];
  
  for (var i = 1; i < 5; i++) {
    let offset = texel_size * BLUR_OFFSETS[i] * bloom_params.blur_radius;
    result += textureSample(bloom_texture, linear_sampler, input.uv + vec2f(0.0, offset)).rgb * BLUR_WEIGHTS[i];
    result += textureSample(bloom_texture, linear_sampler, input.uv - vec2f(0.0, offset)).rgb * BLUR_WEIGHTS[i];
  }
  
  return vec4f(result, 1.0);
}

// Final composite - combine scene with bloom
@fragment
fn fs_composite(input: VertexOutput) -> @location(0) vec4f {
  let scene = textureSample(scene_texture, linear_sampler, input.uv).rgb;
  let bloom = textureSample(bloom_texture, linear_sampler, input.uv).rgb;
  
  // Additive blend with intensity control
  let result = scene + bloom * bloom_params.intensity;
  
  // Subtle tone mapping (Reinhard)
  let mapped = result / (result + vec3f(1.0));
  
  return vec4f(mapped, 1.0);
}

// Chromatic aberration
@fragment
fn fs_chromatic_aberration(input: VertexOutput) -> @location(0) vec4f {
  let to_center = input.uv - vec2f(0.5);
  let dist = length(to_center);
  
  // Aberration strength increases toward edges
  let aberration = 0.003 * dist * dist;
  
  // Sample RGB channels with offset
  let r = textureSample(scene_texture, linear_sampler, input.uv + to_center * aberration).r;
  let g = textureSample(scene_texture, linear_sampler, input.uv).g;
  let b = textureSample(scene_texture, linear_sampler, input.uv - to_center * aberration).b;
  
  return vec4f(r, g, b, 1.0);
}

// Combined post-process (bloom + chromatic aberration)
@fragment
fn fs_post_process(input: VertexOutput) -> @location(0) vec4f {
  // Chromatic aberration
  let to_center = input.uv - vec2f(0.5);
  let dist = length(to_center);
  let aberration = 0.002 * dist;
  
  let r = textureSample(scene_texture, linear_sampler, input.uv + to_center * aberration).r;
  let g = textureSample(scene_texture, linear_sampler, input.uv).g;
  let b = textureSample(scene_texture, linear_sampler, input.uv - to_center * aberration).b;
  let scene = vec3f(r, g, b);
  
  // Add bloom
  let bloom = textureSample(bloom_texture, linear_sampler, input.uv).rgb;
  let result = scene + bloom * bloom_params.intensity;
  
  // Subtle vignette
  let vignette = 1.0 - dist * 0.3;
  
  // Tone mapping
  let mapped = result * vignette / (result * vignette + vec3f(1.0));
  
  return vec4f(mapped, 1.0);
}
