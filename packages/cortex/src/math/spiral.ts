/**
 * Spiral Mathematics
 *
 * Logarithmic and Archimedean spirals for corona fiber generation.
 */

import type { Vec2 } from "../types";

import { TAU } from "./index";

/**
 * Generate points along a logarithmic spiral
 *
 * r(θ) = a * e^(b*θ)
 *
 * @param center - Spiral center point
 * @param startAngle - Starting angle in radians
 * @param a - Initial radius coefficient
 * @param b - Growth rate (negative for inward spiral)
 * @param segments - Number of points to generate
 * @param turns - Number of full rotations
 */
export function generateLogarithmicSpiral(
  center: Vec2,
  startAngle: number,
  a: number,
  b: number,
  segments: number,
  turns: number
): Vec2[] {
  const points: Vec2[] = [];
  const totalAngle = turns * TAU;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = startAngle + t * totalAngle;
    const r = a * Math.exp(b * t * totalAngle);

    points.push({
      x: center.x + r * Math.cos(theta),
      y: center.y + r * Math.sin(theta),
    });
  }

  return points;
}

/**
 * Corona fiber configuration
 */
export type FiberConfig = {
  outerRadius: number;
  innerRadius: number;
  spiralTightness: number;
  segments: number;
  wobbleAmplitude: number;
  wobbleFrequency: number;
};

/**
 * Generate a single corona fiber path
 *
 * @param fiberId - Fiber index (0 to fiberCount-1)
 * @param fiberCount - Total number of fibers
 * @param center - Orb center
 * @param config - Fiber configuration
 * @param time - Animation time
 */
export function generateCoronaFiber(
  fiberId: number,
  fiberCount: number,
  center: Vec2,
  config: FiberConfig,
  time: number
): Vec2[] {
  const points: Vec2[] = [];
  const baseAngle = (fiberId / fiberCount) * TAU;

  for (let i = 0; i <= config.segments; i++) {
    const t = i / config.segments;

    // Logarithmic spiral radius (outer to inner)
    const spiralR =
      config.outerRadius * Math.exp(-config.spiralTightness * t * TAU);
    const r = Math.max(spiralR, config.innerRadius);

    // Angle with rotation
    const theta = baseAngle + t * TAU * 4; // 4 full turns inward

    // Organic wobble decreases toward center
    const wobbleStrength = config.wobbleAmplitude * (1 - t);
    const wobble =
      Math.sin(fiberId * 0.1 + t * config.wobbleFrequency + time * 0.5) *
      wobbleStrength;

    const finalTheta = theta + wobble;

    points.push({
      x: center.x + r * Math.cos(finalTheta),
      y: center.y + r * Math.sin(finalTheta),
    });
  }

  return points;
}

/**
 * Generate all corona fibers as a flat Float32Array for GPU
 *
 * Layout: [x0, y0, x1, y1, ...] for each fiber sequentially
 */
export function generateCoronaFibersBuffer(
  fiberCount: number,
  segmentsPerFiber: number,
  center: Vec2,
  config: FiberConfig,
  time: number
): Float32Array {
  const totalPoints = fiberCount * (segmentsPerFiber + 1);
  const buffer = new Float32Array(totalPoints * 2);

  let offset = 0;
  for (let f = 0; f < fiberCount; f++) {
    const points = generateCoronaFiber(f, fiberCount, center, config, time);
    for (const point of points) {
      buffer[offset++] = point.x;
      buffer[offset++] = point.y;
    }
  }

  return buffer;
}

/**
 * Archimedean spiral for even spacing
 *
 * r(θ) = a + b*θ
 */
export function archimedeanSpiral(theta: number, a: number, b: number): number {
  return a + b * theta;
}

/**
 * Fermat spiral for golden ratio distribution
 *
 * Used for particle spawn positions
 */
export function fermatSpiral(
  index: number,
  count: number,
  maxRadius: number
): Vec2 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  const theta = index * goldenAngle;
  const r = maxRadius * Math.sqrt(index / count);

  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}
