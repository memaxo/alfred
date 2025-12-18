/**
 * Bezier Curve Mathematics
 *
 * Cubic bezier evaluation and utilities for edge rendering.
 */

import type { Vec2 } from "../types";

/**
 * Evaluate cubic bezier at parameter t
 *
 * B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
export function evalCubicBezier(
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
 * Evaluate cubic bezier tangent (first derivative)
 */
export function evalCubicBezierTangent(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

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
 * Evaluate cubic bezier normal (perpendicular to tangent)
 */
export function evalCubicBezierNormal(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const tangent = evalCubicBezierTangent(p0, p1, p2, p3, t);
  const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
  if (len === 0) {
    return { x: 0, y: 1 };
  }
  return {
    x: -tangent.y / len,
    y: tangent.x / len,
  };
}

/**
 * Approximate bezier arc length using adaptive subdivision
 */
export function approximateBezierLength(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  segments = 100
): number {
  let length = 0;
  let prev = p0;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const current = evalCubicBezier(p0, p1, p2, p3, t);
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = current;
  }

  return length;
}

/**
 * Compute control points for a smooth edge between two nodes
 *
 * The curve bulges toward a gravitational center (orb).
 */
export function computeEdgeControlPoints(
  source: Vec2,
  target: Vec2,
  orbCenter: Vec2,
  curvature = 0.3
): { p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 } {
  // Midpoint of edge
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  // Vector from midpoint toward orb
  const toOrbX = orbCenter.x - midX;
  const toOrbY = orbCenter.y - midY;

  // Control points curve toward orb
  return {
    p0: source,
    p1: {
      x: source.x + toOrbX * curvature,
      y: source.y + toOrbY * curvature,
    },
    p2: {
      x: target.x + toOrbX * curvature,
      y: target.y + toOrbY * curvature,
    },
    p3: target,
  };
}

/**
 * Sample points along bezier for particle initialization
 */
export function sampleBezierPoints(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  count: number
): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    points.push(evalCubicBezier(p0, p1, p2, p3, t));
  }
  return points;
}

/**
 * Convert bezier edge to Float32Array for GPU buffer
 *
 * Layout: [p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, active, r, g, b, a, pad, pad, pad]
 * Total: 16 floats (64 bytes, aligned)
 */
export function edgeToFloat32Array(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  active: number,
  color: { r: number; g: number; b: number; a: number }
): Float32Array {
  return new Float32Array([
    p0.x,
    p0.y,
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    p3.x,
    p3.y,
    active,
    color.r,
    color.g,
    color.b,
    color.a,
    0,
    0,
    0, // Padding for alignment
  ]);
}
