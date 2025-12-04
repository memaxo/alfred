# ALFRED UI Implementation Strategy

## Mathematical & WebGPU Optimization Approach

---

## 1. Architecture Overview

### Layer Decomposition

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  React Flow (xyflow) — Node positioning, interactions       ││
│  │  - Node components (Chat, Workflow, Knowledge, Notes)       ││
│  │  - Edge routing (bezier paths passed to WebGPU)             ││
│  │  - User interactions, state management                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  WebGPU Canvas Layer — Visual effects, atmosphere           ││
│  │  - Orb corona rendering                                      ││
│  │  - Particle systems (edges, ambient)                        ││
│  │  - Atmospheric fog/glow                                      ││
│  │  - Post-processing (bloom, chromatic aberration)            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Shared State — Uniforms, transforms, time                  ││
│  │  - Node positions (Float32Array)                            ││
│  │  - Edge paths (control points)                              ││
│  │  - Activity states (which edges active)                     ││
│  │  - Global time for animations                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Rendering Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Compute    │    │   Vertex     │    │   Fragment   │
│   Shaders    │───▶│   Shaders    │───▶│   Shaders    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
  ┌─────────┐        ┌─────────┐        ┌─────────┐
  │Particle │        │  Orb    │        │  Glow   │
  │ Physics │        │ Corona  │        │  Bloom  │
  └─────────┘        └─────────┘        └─────────┘
  ┌─────────┐        ┌─────────┐        ┌─────────┐
  │  Noise  │        │  Edges  │        │  Fog    │
  │  Fields │        │         │        │         │
  └─────────┘        └─────────┘        └─────────┘
```

---

## 2. Mathematical Foundations

### 2.1 Gravitational Particle System

Particles drift toward the orb using inverse-square gravitational attraction:

```
F = G * (m₁ * m₂) / r²

Where:
  F = Force vector toward orb
  G = Gravitational constant (tunable)
  m₁ = Orb mass (constant, large)
  m₂ = Particle mass (constant, small)
  r = Distance from particle to orb center
```

**WGSL Compute Shader:**

```wgsl
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  life: f32,
  size: f32,
}

struct Uniforms {
  orb_center: vec2<f32>,
  orb_mass: f32,
  delta_time: f32,
  gravity_constant: f32,
  damping: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(256)
fn update_particles(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= arrayLength(&particles)) { return; }
  
  var p = particles[idx];
  
  // Vector from particle to orb
  let to_orb = uniforms.orb_center - p.position;
  let distance = length(to_orb);
  let direction = normalize(to_orb);
  
  // Gravitational force (clamped to prevent singularity)
  let min_dist = 50.0; // Event horizon
  let effective_dist = max(distance, min_dist);
  let force_magnitude = uniforms.gravity_constant * uniforms.orb_mass / (effective_dist * effective_dist);
  
  // Apply force
  let acceleration = direction * force_magnitude;
  p.velocity += acceleration * uniforms.delta_time;
  
  // Damping for stability
  p.velocity *= uniforms.damping;
  
  // Update position
  p.position += p.velocity * uniforms.delta_time;
  
  // Decay life as approaching orb
  if (distance < min_dist * 2.0) {
    p.life -= uniforms.delta_time * 2.0;
  }
  
  // Respawn dead particles at edge
  if (p.life <= 0.0 || distance < min_dist) {
    p = respawn_particle(idx);
  }
  
  particles[idx] = p;
}

fn respawn_particle(seed: u32) -> Particle {
  // Spawn at random position on frame edge
  let angle = random(seed) * 6.283185;
  let radius = 1200.0; // Frame diagonal / 2
  
  return Particle(
    vec2<f32>(cos(angle), sin(angle)) * radius + uniforms.orb_center,
    vec2<f32>(0.0, 0.0),
    1.0 + random(seed + 1u) * 0.5, // Life 1.0-1.5
    1.0 + random(seed + 2u) * 2.0, // Size 1-3px
  );
}
```

### 2.2 Orb Corona — Fiber Simulation

The corona consists of thousands of fibers spiraling inward. Each fiber is a parametric curve:

```
Logarithmic Spiral:
  r(θ) = a * e^(b*θ)

Where:
  a = initial radius
  b = spiral tightness (negative for inward spiral)
  θ = angle parameter

Fiber position at parameter t:
  x(t) = r(θ(t)) * cos(θ(t)) + center.x
  y(t) = r(θ(t)) * sin(θ(t)) + center.y
  
With perturbation:
  θ(t) = base_angle + t * rotation_speed + noise(t, time) * wobble
```

**WGSL Vertex Shader for Corona Fibers:**

```wgsl
struct FiberVertex {
  @location(0) fiber_id: u32,      // Which fiber (0-2000)
  @location(1) segment_t: f32,     // Parameter along fiber (0-1)
}

struct CoronaUniforms {
  center: vec2<f32>,
  inner_radius: f32,
  outer_radius: f32,
  time: f32,
  rotation_speed: f32,
  spiral_tightness: f32,
  fiber_count: u32,
}

@group(0) @binding(0) var<uniform> u: CoronaUniforms;

fn simplex_noise_2d(p: vec2<f32>) -> f32 {
  // Simplex noise implementation
  // ... (standard implementation)
}

@vertex
fn vs_corona(input: FiberVertex) -> @builtin(position) vec4<f32> {
  let fiber_id = f32(input.fiber_id);
  let t = input.segment_t;
  
  // Base angle for this fiber (evenly distributed)
  let base_angle = (fiber_id / f32(u.fiber_count)) * 6.283185;
  
  // Spiral parameter
  let theta = base_angle + t * 4.0 * 3.14159 + u.time * u.rotation_speed;
  
  // Logarithmic spiral radius
  let spiral_r = u.outer_radius * exp(-u.spiral_tightness * t);
  
  // Clamp to inner radius (event horizon)
  let r = max(spiral_r, u.inner_radius);
  
  // Add organic wobble using noise
  let noise_input = vec2<f32>(fiber_id * 0.1, t * 10.0 + u.time * 0.5);
  let wobble = simplex_noise_2d(noise_input) * 0.1 * (1.0 - t); // Less wobble near center
  
  let final_theta = theta + wobble;
  
  // Final position
  let pos = vec2<f32>(
    cos(final_theta) * r + u.center.x,
    sin(final_theta) * r + u.center.y
  );
  
  return vec4<f32>(pos / vec2<f32>(1920.0, 1080.0) * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fs_corona(@builtin(position) pos: vec4<f32>, @location(0) t: f32) -> @location(0) vec4<f32> {
  // Brightness increases toward center
  let brightness = 0.3 + 0.7 * t;
  
  // Color: white at center, cyan at edge
  let color = mix(
    vec3<f32>(0.0, 1.0, 0.53), // Cyan outer
    vec3<f32>(1.0, 1.0, 1.0),   // White inner
    t
  );
  
  // Alpha fades at both ends
  let alpha = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.9, t) * brightness;
  
  return vec4<f32>(color, alpha);
}
```

### 2.3 Living Edges — Bezier Particle Streams

Edges are cubic Bezier curves with particles flowing along them:

```
Cubic Bezier:
  B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃

Where:
  P₀ = Start node position
  P₁ = Control point 1 (offset from P₀)
  P₂ = Control point 2 (offset from P₃)
  P₃ = End node position (orb)
  t = Parameter [0, 1]
```

**Edge Particle Compute Shader:**

```wgsl
struct EdgeParticle {
  t: f32,           // Position along bezier (0-1)
  speed: f32,       // Movement speed
  offset: f32,      // Perpendicular offset from curve
  brightness: f32,  // Particle brightness
}

struct Edge {
  p0: vec2<f32>,  // Start
  p1: vec2<f32>,  // Control 1
  p2: vec2<f32>,  // Control 2
  p3: vec2<f32>,  // End (orb)
  active: f32,    // 0 = dormant, 1 = active
  color: vec3<f32>,
}

fn cubic_bezier(p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>, t: f32) -> vec2<f32> {
  let t2 = t * t;
  let t3 = t2 * t;
  let mt = 1.0 - t;
  let mt2 = mt * mt;
  let mt3 = mt2 * mt;
  
  return mt3 * p0 + 3.0 * mt2 * t * p1 + 3.0 * mt * t2 * p2 + t3 * p3;
}

fn bezier_tangent(p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>, t: f32) -> vec2<f32> {
  let t2 = t * t;
  let mt = 1.0 - t;
  let mt2 = mt * mt;
  
  // Derivative of cubic bezier
  return 3.0 * mt2 * (p1 - p0) + 6.0 * mt * t * (p2 - p1) + 3.0 * t2 * (p3 - p2);
}

@compute @workgroup_size(64)
fn update_edge_particles(
  @builtin(global_invocation_id) id: vec3<u32>,
  @group(0) @binding(0) var<storage, read_write> particles: array<EdgeParticle>,
  @group(0) @binding(1) var<uniform> edge: Edge,
  @group(0) @binding(2) var<uniform> time: f32,
  @group(0) @binding(3) var<uniform> delta: f32,
) {
  let idx = id.x;
  var p = particles[idx];
  
  // Only animate if edge is active
  if (edge.active > 0.5) {
    p.t += p.speed * delta * edge.active;
    
    // Loop back to start
    if (p.t > 1.0) {
      p.t = p.t - 1.0;
      p.offset = (random(idx + u32(time * 1000.0)) - 0.5) * 10.0;
    }
    
    // Brightness pulses
    p.brightness = 0.5 + 0.5 * sin(p.t * 6.283185 + time * 3.0);
  } else {
    // Dormant: slow fade
    p.brightness = max(0.0, p.brightness - delta * 0.5);
  }
  
  particles[idx] = p;
}

@vertex
fn vs_edge_particle(
  @location(0) particle_idx: u32,
  @builtin(instance_index) edge_idx: u32,
) -> VertexOutput {
  let p = particles[particle_idx];
  let e = edges[edge_idx];
  
  // Position on curve
  let curve_pos = cubic_bezier(e.p0, e.p1, e.p2, e.p3, p.t);
  
  // Perpendicular offset
  let tangent = normalize(bezier_tangent(e.p0, e.p1, e.p2, e.p3, p.t));
  let normal = vec2<f32>(-tangent.y, tangent.x);
  
  let final_pos = curve_pos + normal * p.offset;
  
  var out: VertexOutput;
  out.position = vec4<f32>(screen_transform(final_pos), 0.0, 1.0);
  out.color = vec4<f32>(e.color, p.brightness * e.active);
  out.size = 2.0 + p.brightness * 2.0;
  
  return out;
}
```

### 2.4 Signed Distance Functions for Glow

Efficient glow effects using SDF:

```
Circle SDF:
  d = length(p - center) - radius
  
Glow from SDF:
  glow = exp(-d * falloff) * intensity
```

**Fragment Shader for Node Glow:**

```wgsl
fn sdf_circle(p: vec2<f32>, center: vec2<f32>, radius: f32) -> f32 {
  return length(p - center) - radius;
}

fn glow_from_sdf(d: f32, falloff: f32, intensity: f32) -> f32 {
  return exp(-max(d, 0.0) * falloff) * intensity;
}

@fragment
fn fs_node_glow(
  @builtin(position) frag_pos: vec4<f32>,
  @location(0) node_center: vec2<f32>,
  @location(1) node_radius: f32,
  @location(2) node_color: vec3<f32>,
  @location(3) node_activity: f32,
) -> @location(0) vec4<f32> {
  let p = frag_pos.xy;
  
  // Distance to node edge
  let d = sdf_circle(p, node_center, node_radius);
  
  // Ring (stroke)
  let ring_width = 2.0;
  let ring = smoothstep(ring_width, 0.0, abs(d));
  
  // Inner glow
  let inner_glow = glow_from_sdf(-d, 0.02, 0.3) * step(d, 0.0);
  
  // Outer glow (stronger when active)
  let outer_falloff = mix(0.05, 0.02, node_activity);
  let outer_intensity = mix(0.2, 0.6, node_activity);
  let outer_glow = glow_from_sdf(d, outer_falloff, outer_intensity);
  
  // Combine
  let brightness = ring + inner_glow + outer_glow;
  let color = node_color * brightness;
  
  // Pulsing when active
  let pulse = 1.0 + sin(time * 3.0) * 0.1 * node_activity;
  
  return vec4<f32>(color * pulse, brightness);
}
```

### 2.5 Noise Functions for Organic Movement

**Simplex Noise in WGSL:**

```wgsl
// 2D Simplex noise for organic perturbations
fn mod289(x: vec2<f32>) -> vec2<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec3<f32>) -> vec3<f32> {
  return mod289_3(((x * 34.0) + 1.0) * x);
}

fn simplex_noise_2d(v: vec2<f32>) -> f32 {
  let C = vec4<f32>(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );
  
  // First corner
  var i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);
  
  // Other corners
  var i1: vec2<f32>;
  if (x0.x > x0.y) {
    i1 = vec2<f32>(1.0, 0.0);
  } else {
    i1 = vec2<f32>(0.0, 1.0);
  }
  
  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4<f32>(x12.xy - i1, x12.zw);
  
  // Permutations
  i = mod289(i);
  let p = permute(permute(i.y + vec3<f32>(0.0, i1.y, 1.0)) + i.x + vec3<f32>(0.0, i1.x, 1.0));
  
  var m = max(vec3<f32>(0.5) - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
  m = m * m;
  m = m * m;
  
  // Gradients
  let x = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(x) - 0.5;
  let ox = floor(x + 0.5);
  let a0 = x - ox;
  
  // Normalize gradients
  m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));
  
  // Compute final noise value
  let g = vec3<f32>(
    a0.x * x0.x + h.x * x0.y,
    a0.y * x12.x + h.y * x12.y,
    a0.z * x12.z + h.z * x12.w
  );
  
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion for more organic feel
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var p_var = p;
  
  for (var i = 0; i < octaves; i++) {
    value += amplitude * simplex_noise_2d(p_var * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}
```

---

## 3. Component Architecture

### 3.1 WebGPU Canvas Component

```typescript
// packages/ui/src/webgpu/mindscape-canvas.tsx

import { useEffect, useRef, useCallback } from 'react';
import { useWebGPU } from './use-webgpu';
import { ParticleSystem } from './systems/particles';
import { CoronaRenderer } from './systems/corona';
import { EdgeRenderer } from './systems/edges';
import { PostProcessor } from './systems/post-process';

interface MindscapeCanvasProps {
  orbPosition: [number, number];
  orbState: 'dormant' | 'idle' | 'listening' | 'active' | 'processing';
  nodes: NodeData[];
  edges: EdgeData[];
  className?: string;
}

export function MindscapeCanvas({
  orbPosition,
  orbState,
  nodes,
  edges,
  className,
}: MindscapeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { device, context, format } = useWebGPU(canvasRef);
  
  // Systems
  const particleSystem = useRef<ParticleSystem>();
  const coronaRenderer = useRef<CoronaRenderer>();
  const edgeRenderer = useRef<EdgeRenderer>();
  const postProcessor = useRef<PostProcessor>();
  
  // Initialize systems
  useEffect(() => {
    if (!device || !context) return;
    
    particleSystem.current = new ParticleSystem(device, {
      maxParticles: 5000,
      orbPosition,
      gravityConstant: 50.0,
    });
    
    coronaRenderer.current = new CoronaRenderer(device, {
      fiberCount: 2000,
      segmentsPerFiber: 50,
      innerRadius: 150,
      outerRadius: 400,
    });
    
    edgeRenderer.current = new EdgeRenderer(device, {
      particlesPerEdge: 100,
    });
    
    postProcessor.current = new PostProcessor(device, format, {
      bloomIntensity: 0.3,
      bloomRadius: 10,
    });
    
    return () => {
      particleSystem.current?.destroy();
      coronaRenderer.current?.destroy();
      edgeRenderer.current?.destroy();
      postProcessor.current?.destroy();
    };
  }, [device, context, format]);
  
  // Update uniforms when props change
  useEffect(() => {
    particleSystem.current?.updateOrbPosition(orbPosition);
    coronaRenderer.current?.updateCenter(orbPosition);
    coronaRenderer.current?.updateState(orbState);
  }, [orbPosition, orbState]);
  
  useEffect(() => {
    edgeRenderer.current?.updateEdges(edges);
  }, [edges]);
  
  // Render loop
  const render = useCallback((time: number) => {
    if (!device || !context) return;
    
    const deltaTime = time - lastTime.current;
    lastTime.current = time;
    
    const commandEncoder = device.createCommandEncoder();
    
    // 1. Compute pass: update particles
    particleSystem.current?.compute(commandEncoder, deltaTime);
    edgeRenderer.current?.computeParticles(commandEncoder, deltaTime);
    
    // 2. Render pass: draw everything
    const renderTexture = postProcessor.current?.getRenderTexture();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: renderTexture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    // Draw order: back to front
    edgeRenderer.current?.render(renderPass);      // Edges behind
    coronaRenderer.current?.render(renderPass);    // Corona
    particleSystem.current?.render(renderPass);    // Ambient particles on top
    
    renderPass.end();
    
    // 3. Post-processing pass: bloom, etc.
    postProcessor.current?.process(commandEncoder, context.getCurrentTexture());
    
    device.queue.submit([commandEncoder.finish()]);
    
    requestAnimationFrame(render);
  }, [device, context]);
  
  useEffect(() => {
    const frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [render]);
  
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}
```

### 3.2 Particle System Class

```typescript
// packages/ui/src/webgpu/systems/particles.ts

export class ParticleSystem {
  private device: GPUDevice;
  private particleBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private computePipeline: GPUComputePipeline;
  private renderPipeline: GPURenderPipeline;
  private bindGroup: GPUBindGroup;
  
  private config: ParticleConfig;
  
  constructor(device: GPUDevice, config: ParticleConfig) {
    this.device = device;
    this.config = config;
    
    // Create particle buffer (position, velocity, life, size)
    const particleData = new Float32Array(config.maxParticles * 6);
    this.initializeParticles(particleData);
    
    this.particleBuffer = device.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.particleBuffer.getMappedRange()).set(particleData);
    this.particleBuffer.unmap();
    
    // Uniform buffer
    this.uniformBuffer = device.createBuffer({
      size: 32, // orb_center(8) + orb_mass(4) + delta_time(4) + gravity(4) + damping(4) + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create pipelines
    this.computePipeline = this.createComputePipeline();
    this.renderPipeline = this.createRenderPipeline();
    this.bindGroup = this.createBindGroup();
  }
  
  private initializeParticles(data: Float32Array) {
    const { orbPosition, maxParticles } = this.config;
    
    for (let i = 0; i < maxParticles; i++) {
      const offset = i * 6;
      
      // Random position on frame edge
      const angle = Math.random() * Math.PI * 2;
      const radius = 1200;
      
      data[offset + 0] = Math.cos(angle) * radius + orbPosition[0]; // x
      data[offset + 1] = Math.sin(angle) * radius + orbPosition[1]; // y
      data[offset + 2] = 0; // vx
      data[offset + 3] = 0; // vy
      data[offset + 4] = Math.random() * 0.5 + 0.5; // life
      data[offset + 5] = Math.random() * 2 + 1; // size
    }
  }
  
  private createComputePipeline(): GPUComputePipeline {
    const shaderModule = this.device.createShaderModule({
      code: PARTICLE_COMPUTE_SHADER, // The WGSL from section 2.1
    });
    
    return this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'update_particles',
      },
    });
  }
  
  private createRenderPipeline(): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      code: PARTICLE_RENDER_SHADER,
    });
    
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_particle',
        buffers: [{
          arrayStride: 24, // 6 floats
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
            { shaderLocation: 1, offset: 8, format: 'float32x2' },  // velocity
            { shaderLocation: 2, offset: 16, format: 'float32' },   // life
            { shaderLocation: 3, offset: 20, format: 'float32' },   // size
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_particle',
        targets: [{
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'point-list' },
    });
  }
  
  compute(encoder: GPUCommandEncoder, deltaTime: number) {
    // Update uniforms
    const uniformData = new Float32Array([
      this.config.orbPosition[0],
      this.config.orbPosition[1],
      this.config.orbMass ?? 1000,
      deltaTime / 1000, // Convert to seconds
      this.config.gravityConstant,
      this.config.damping ?? 0.99,
      0, 0, // padding
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.config.maxParticles / 256));
    pass.end();
  }
  
  render(pass: GPURenderPassEncoder) {
    pass.setPipeline(this.renderPipeline);
    pass.setVertexBuffer(0, this.particleBuffer);
    pass.draw(this.config.maxParticles);
  }
  
  updateOrbPosition(position: [number, number]) {
    this.config.orbPosition = position;
  }
  
  destroy() {
    this.particleBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
```

### 3.3 React Flow Integration

```typescript
// apps/web/src/components/mindscape/canvas.tsx

import { ReactFlow, useNodesState, useEdgesState, useReactFlow } from '@xyflow/react';
import { MindscapeCanvas } from '@alfred/ui/webgpu';
import { useMindscapeStore } from '@/store/mindscape';

export function MindscapeView() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useMindscapeStore(
    useShallow(state => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
    }))
  );
  
  const reactFlow = useReactFlow();
  
  // Extract orb position from nodes
  const orbNode = nodes.find(n => n.type === 'orb');
  const orbPosition: [number, number] = orbNode 
    ? [orbNode.position.x + 200, orbNode.position.y + 200] // Center of 400px orb
    : [960, 450];
  
  // Convert React Flow edges to WebGPU edge data
  const webgpuEdges = useMemo(() => {
    return edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return null;
      
      // Calculate bezier control points
      const sourcePos = getNodeCenter(sourceNode);
      const targetPos = getNodeCenter(targetNode);
      
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      
      // Curve toward orb
      const toOrb = [orbPosition[0] - midX, orbPosition[1] - midY];
      const curvature = 0.3;
      
      return {
        id: edge.id,
        p0: [sourcePos.x, sourcePos.y],
        p1: [sourcePos.x + toOrb[0] * curvature, sourcePos.y + toOrb[1] * curvature],
        p2: [targetPos.x + toOrb[0] * curvature, targetPos.y + toOrb[1] * curvature],
        p3: [targetPos.x, targetPos.y],
        active: edge.data?.active ?? false,
        color: getEdgeColor(edge),
      };
    }).filter(Boolean);
  }, [edges, nodes, orbPosition]);
  
  return (
    <div className="relative w-full h-full bg-[#000000]">
      {/* WebGPU Canvas - Atmospheric effects */}
      <MindscapeCanvas
        orbPosition={orbPosition}
        orbState={orbNode?.data?.state ?? 'idle'}
        nodes={nodes}
        edges={webgpuEdges}
        className="z-0"
      />
      
      {/* React Flow - Interactive nodes */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        className="z-10"
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        {/* No background - WebGPU handles it */}
      </ReactFlow>
    </div>
  );
}
```

---

## 4. Optimization Strategies

### 4.1 GPU Memory Layout

```
Particle Buffer Layout (Struct of Arrays for cache efficiency):
┌──────────────────────────────────────────────────────────────┐
│ positions_x: [f32; MAX_PARTICLES]                            │
│ positions_y: [f32; MAX_PARTICLES]                            │
│ velocities_x: [f32; MAX_PARTICLES]                           │
│ velocities_y: [f32; MAX_PARTICLES]                           │
│ life: [f32; MAX_PARTICLES]                                   │
│ size: [f32; MAX_PARTICLES]                                   │
└──────────────────────────────────────────────────────────────┘

Benefits:
- Coalesced memory access in compute shaders
- Better GPU cache utilization
- Reduced memory bandwidth
```

### 4.2 Level of Detail (LOD) for Particles

```typescript
// Reduce particle count based on zoom level
function getParticleCount(zoom: number): number {
  if (zoom < 0.3) return 500;      // Tiny: minimal particles
  if (zoom < 0.6) return 1500;     // Small: reduced
  if (zoom < 1.0) return 3000;     // Medium: moderate
  return 5000;                      // Full: all particles
}

// Reduce corona fiber count based on zoom
function getFiberCount(zoom: number): number {
  if (zoom < 0.3) return 200;
  if (zoom < 0.6) return 500;
  if (zoom < 1.0) return 1000;
  return 2000;
}
```

### 4.3 Spatial Partitioning for Edges

```typescript
// Only render edges visible in viewport
class EdgeSpatialIndex {
  private grid: Map<string, EdgeData[]> = new Map();
  private cellSize = 200;
  
  insert(edge: EdgeData) {
    const cells = this.getCellsForBezier(edge);
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key)!.push(edge);
    }
  }
  
  queryViewport(viewport: Rect): EdgeData[] {
    const edges = new Set<EdgeData>();
    const minCell = this.worldToCell(viewport.x, viewport.y);
    const maxCell = this.worldToCell(viewport.x + viewport.width, viewport.y + viewport.height);
    
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        const key = `${x},${y}`;
        const cellEdges = this.grid.get(key);
        if (cellEdges) {
          cellEdges.forEach(e => edges.add(e));
        }
      }
    }
    
    return Array.from(edges);
  }
}
```

### 4.4 Double Buffering for Particle Updates

```typescript
class DoubleBufferedParticles {
  private buffers: [GPUBuffer, GPUBuffer];
  private currentIndex = 0;
  
  get readBuffer() { return this.buffers[this.currentIndex]; }
  get writeBuffer() { return this.buffers[1 - this.currentIndex]; }
  
  swap() {
    this.currentIndex = 1 - this.currentIndex;
  }
  
  // Compute shader reads from one, writes to other
  // Then swap for next frame
}
```

### 4.5 Render Target Optimization

```typescript
// Use half-float textures for HDR without full float cost
const renderTargetFormat: GPUTextureFormat = 'rgba16float';

// Render at lower resolution, upscale for post-processing
const internalScale = 0.75; // Render at 75% resolution

function createRenderTarget(width: number, height: number) {
  return device.createTexture({
    size: [
      Math.floor(width * internalScale),
      Math.floor(height * internalScale),
      1,
    ],
    format: renderTargetFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
}
```

---

## 5. Post-Processing Pipeline

### 5.1 Bloom Effect

```wgsl
// Bloom extraction - pull bright pixels
@fragment
fn bloom_extract(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, linearSampler, uv);
  
  // Luminance
  let luma = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
  
  // Threshold
  let threshold = 0.8;
  let soft_threshold = 0.2;
  let knee = threshold * soft_threshold;
  
  let soft = luma - threshold + knee;
  let soft_clamped = clamp(soft, 0.0, 2.0 * knee);
  let soft_weight = soft_clamped * soft_clamped / (4.0 * knee + 0.00001);
  
  let weight = max(soft_weight, luma - threshold) / max(luma, 0.00001);
  
  return vec4<f32>(color.rgb * weight, 1.0);
}

// Gaussian blur (separable, 9-tap)
const BLUR_WEIGHTS: array<f32, 5> = array(0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

@fragment
fn blur_horizontal(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let texel_size = 1.0 / vec2<f32>(textureDimensions(inputTexture));
  var result = textureSample(inputTexture, linearSampler, uv) * BLUR_WEIGHTS[0];
  
  for (var i = 1; i < 5; i++) {
    let offset = vec2<f32>(texel_size.x * f32(i), 0.0);
    result += textureSample(inputTexture, linearSampler, uv + offset) * BLUR_WEIGHTS[i];
    result += textureSample(inputTexture, linearSampler, uv - offset) * BLUR_WEIGHTS[i];
  }
  
  return result;
}

// Final composite
@fragment
fn bloom_composite(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let scene = textureSample(sceneTexture, linearSampler, uv);
  let bloom = textureSample(bloomTexture, linearSampler, uv);
  
  // Additive blend
  return vec4<f32>(scene.rgb + bloom.rgb * bloomIntensity, scene.a);
}
```

### 5.2 Chromatic Aberration (Holographic Effect)

```wgsl
@fragment
fn chromatic_aberration(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let center = vec2<f32>(0.5, 0.5);
  let to_center = uv - center;
  let dist = length(to_center);
  
  // Aberration increases toward edges
  let aberration_amount = 0.002 * dist;
  
  let r = textureSample(inputTexture, linearSampler, uv + to_center * aberration_amount).r;
  let g = textureSample(inputTexture, linearSampler, uv).g;
  let b = textureSample(inputTexture, linearSampler, uv - to_center * aberration_amount).b;
  
  return vec4<f32>(r, g, b, 1.0);
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)

```
Tasks:
├── WebGPU initialization & fallback detection
├── Basic canvas component
├── Particle system (gravity toward orb)
├── Simple orb rendering (circle with glow)
└── React Flow integration (transparent overlay)

Deliverables:
- Particles drift toward center
- Orb displays with basic glow
- Nodes render on top via React Flow
```

### Phase 2: Corona & Edges (Week 3-4)

```
Tasks:
├── Corona fiber shader
├── Logarithmic spiral math
├── Edge bezier calculation
├── Edge particle system
└── Active/dormant edge states

Deliverables:
- Vortex corona animates
- Edges show particle flow when active
- Visual connection between nodes and orb
```

### Phase 3: Post-Processing (Week 5-6)

```
Tasks:
├── Bloom pipeline
├── Chromatic aberration
├── Node glow shaders (SDF)
├── LOD system integration
└── Performance profiling & optimization

Deliverables:
- Glowing, cinematic look
- Smooth performance at 60fps
- LOD reduces GPU load when zoomed out
```

### Phase 4: States & Polish (Week 7-8)

```
Tasks:
├── Orb state animations (dormant → active)
├── Node state transitions
├── Message appearance effects
├── Atmospheric fog layer
├── Mobile/fallback rendering (Canvas 2D)

Deliverables:
- Full state machine for visual elements
- Graceful degradation on non-WebGPU devices
- Production-ready performance
```

---

## 7. Fallback Strategy

For devices without WebGPU:

```typescript
// packages/ui/src/webgpu/use-webgpu.ts

export function useWebGPU(canvasRef: RefObject<HTMLCanvasElement>) {
  const [support, setSupport] = useState<'webgpu' | 'webgl' | 'canvas2d'>('canvas2d');
  
  useEffect(() => {
    async function detect() {
      if ('gpu' in navigator) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          setSupport('webgpu');
          return;
        }
      }
      
      const canvas = document.createElement('canvas');
      if (canvas.getContext('webgl2')) {
        setSupport('webgl');
        return;
      }
      
      setSupport('canvas2d');
    }
    detect();
  }, []);
  
  return support;
}

// Render different implementations based on support
function MindscapeCanvas(props: MindscapeCanvasProps) {
  const support = useWebGPU();
  
  switch (support) {
    case 'webgpu':
      return <WebGPUCanvas {...props} />;
    case 'webgl':
      return <WebGLCanvas {...props} />;  // Three.js fallback
    default:
      return <Canvas2DCanvas {...props} />; // Simple CSS/Canvas fallback
  }
}
```

### Canvas2D Fallback (Minimal)

```typescript
// Simplified rendering for low-end devices
function Canvas2DCanvas({ orbPosition, nodes, edges }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    function render() {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1920, 1080);
      
      // Simple orb glow
      const gradient = ctx.createRadialGradient(
        orbPosition[0], orbPosition[1], 0,
        orbPosition[0], orbPosition[1], 200
      );
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1920, 1080);
      
      // Orb circle
      ctx.beginPath();
      ctx.arc(orbPosition[0], orbPosition[1], 150, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Simple edges
      edges.forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(edge.p0[0], edge.p0[1]);
        ctx.bezierCurveTo(
          edge.p1[0], edge.p1[1],
          edge.p2[0], edge.p2[1],
          edge.p3[0], edge.p3[1]
        );
        ctx.strokeStyle = edge.active 
          ? 'rgba(0, 255, 136, 0.6)' 
          : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = edge.active ? 2 : 1;
        ctx.stroke();
      });
      
      requestAnimationFrame(render);
    }
    
    render();
  }, [orbPosition, edges]);
  
  return <canvas ref={canvasRef} width={1920} height={1080} />;
}
```

---

## 8. Performance Budgets

| Component | Budget | Metric |
|-----------|--------|--------|
| Particle compute | < 2ms | GPU time per frame |
| Corona render | < 3ms | GPU time per frame |
| Edge render | < 2ms | GPU time per frame |
| Post-processing | < 3ms | GPU time per frame |
| **Total GPU** | < 10ms | 100fps headroom |
| React Flow update | < 5ms | JS main thread |
| State sync | < 1ms | JS main thread |
| **Total Frame** | < 16ms | 60fps target |

### Monitoring

```typescript
// Performance monitoring hook
function usePerformanceMonitor() {
  const gpuTiming = useRef<GPUQuerySet>();
  const metrics = useRef({
    particleCompute: 0,
    coronaRender: 0,
    edgeRender: 0,
    postProcess: 0,
  });
  
  // Log when exceeding budgets
  useEffect(() => {
    const interval = setInterval(() => {
      const total = Object.values(metrics.current).reduce((a, b) => a + b, 0);
      if (total > 10) {
        console.warn('GPU budget exceeded:', metrics.current);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return metrics;
}
```

---

This strategy provides a complete roadmap from mathematical foundations through implementation details to performance optimization, enabling accurate translation of the design reference images into a performant, interactive interface.