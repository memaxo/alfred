/**
 * Cortex Mathematical Primitives
 *
 * Core mathematical functions for the GPU rendering engine.
 * Designed for both CPU-side calculations and WGSL shader parity.
 */

import type { Vec2 } from "../types";

/** Mathematical constants */
export const TAU = Math.PI * 2;
export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_RATIO = PHI;

/**
 * Create a 2D vector
 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

/**
 * Vector addition
 */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Vector subtraction
 */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Scalar multiplication
 */
export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/**
 * Vector length (magnitude)
 */
export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Normalize vector to unit length
 */
export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product
 */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two vectors
 */
export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Smoothstep interpolation
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Logarithmic spiral: r(θ) = a * e^(b*θ)
 *
 * Used for corona fiber paths.
 * @param theta - Angle in radians
 * @param a - Initial radius
 * @param b - Spiral tightness (negative for inward spiral)
 */
export function logarithmicSpiral(theta: number, a: number, b: number): number {
  return a * Math.exp(b * theta);
}

/**
 * Convert logarithmic spiral to Cartesian coordinates
 */
export function logarithmicSpiralPoint(
  theta: number,
  a: number,
  b: number,
  center: Vec2
): Vec2 {
  const r = logarithmicSpiral(theta, a, b);
  return {
    x: Math.cos(theta) * r + center.x,
    y: Math.sin(theta) * r + center.y,
  };
}

/**
 * Gravitational force magnitude: F = G * M / r²
 *
 * @param mass - Mass of attracting body
 * @param distance - Distance from mass center
 * @param G - Gravitational constant
 */
export function gravitationalForce(
  mass: number,
  distance: number,
  G: number
): number {
  const minDist = 50; // Prevent singularity (event horizon)
  const effectiveDist = Math.max(distance, minDist);
  return (G * mass) / (effectiveDist * effectiveDist);
}

/**
 * Cubic Bezier evaluation: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
export function cubicBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Cubic Bezier tangent (derivative)
 */
export function cubicBezierTangent(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  // Derivative: 3(1-t)²(P₁-P₀) + 6(1-t)t(P₂-P₁) + 3t²(P₃-P₂)
  return {
    x:
      3 * mt2 * (p1.x - p0.x) +
      6 * mt * t * (p2.x - p1.x) +
      3 * t2 * (p3.x - p2.x),
    y:
      3 * mt2 * (p1.y - p0.y) +
      6 * mt * t * (p2.y - p1.y) +
      3 * t2 * (p3.y - p2.y),
  };
}

/**
 * Perpendicular vector (rotate 90° counterclockwise)
 */
export function perpendicular(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

/**
 * Signed distance to circle
 */
export function sdfCircle(p: Vec2, center: Vec2, radius: number): number {
  return length(sub(p, center)) - radius;
}

/**
 * Glow falloff from SDF
 */
export function glowFromSdf(
  d: number,
  falloff: number,
  intensity: number
): number {
  return Math.exp(-Math.max(d, 0) * falloff) * intensity;
}

export * from "./bezier";
// Re-export noise and spiral modules
export * from "./noise";
export * from "./spiral";
