/**
 * Cortex Engine Core Types
 *
 * Mathematical types and interfaces for the GPU rendering engine.
 * All vectors use Float32Array for direct GPU buffer compatibility.
 */

/** 2D vector for screen coordinates and UV */
export interface Vec2 {
  x: number;
  y: number;
}

/** 3D vector for spatial coordinates with depth */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 4D vector for homogeneous coordinates */
export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** RGBA color with values in [0, 1] */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 4D point in unified coordinate system */
export interface Point4D {
  x: number; // Screen X
  y: number; // Screen Y
  z: number; // Depth (0 = closest, 1 = farthest)
  t: number; // Time (epoch-relative)
  s: number[]; // Semantic embedding (N-dimensional)
}

/** Camera state for viewport transforms */
export interface Camera {
  center: Vec2;
  zoom: number;
  depthFactor: number;
  semanticBasis: Float32Array; // 2xN matrix for semantic projection
}

/** Viewport rectangle */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Particle data for GPU buffer */
export interface Particle {
  position: Vec2;
  velocity: Vec2;
  life: number;
  size: number;
}

/** Edge data for bezier rendering */
export interface EdgeData {
  id: string;
  p0: Vec2; // Start point
  p1: Vec2; // Control point 1
  p2: Vec2; // Control point 2
  p3: Vec2; // End point
  active: number; // 0 = dormant, 1 = active
  color: Color;
}

/** Node data for SDF rendering */
export interface NodeData {
  id: string;
  position: Vec2;
  radius: number;
  activity: number; // 0 = idle, 1 = focused
  color: Color;
  type: string;
}

/** Orb state for corona rendering */
export type OrbState =
  | "dormant"
  | "idle"
  | "listening"
  | "active"
  | "processing";

/** Orb configuration */
export interface OrbConfig {
  center: Vec2;
  innerRadius: number;
  outerRadius: number;
  state: OrbState;
  fiberCount: number;
  segmentsPerFiber: number;
  rotationSpeed: number;
}

/** LOD level configuration */
export interface LODLevel {
  particles: number;
  fibers: number;
  edgeParticles: number;
}

/** Render system interface */
export interface RenderSystem {
  name: string;
  init(device: GPUDevice): Promise<void>;
  update(dt: number, uniforms: Float32Array): void;
  render(encoder: GPUCommandEncoder, target: GPUTextureView): void;
  destroy(): void;
}

/** Frame graph node for render pass ordering */
export interface FrameGraphNode {
  name: string;
  inputs: string[];
  outputs: string[];
  execute: (encoder: GPUCommandEncoder) => void;
}

/** Global uniforms passed to all shaders */
export interface GlobalUniforms {
  time: number;
  deltaTime: number;
  resolution: Vec2;
  mouse: Vec2;
  orbCenter: Vec2;
  orbState: number;
  audioLow: number;
  audioMid: number;
  zoom: number;
}

/** Buffer pool entry for double buffering */
export interface PooledBuffer {
  buffer: GPUBuffer;
  size: number;
  lastUsed: number;
}
