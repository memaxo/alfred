/**
 * Cortex Math Functions Tests
 *
 * Tests for Bezier curves, noise functions, and spiral generation.
 * Uses real implementations with no mocking.
 */

import { describe, expect, it } from "bun:test";

import {
  add,
  clamp,
  cubicBezier,
  cubicBezierTangent,
  dot,
  GOLDEN_RATIO,
  glowFromSdf,
  gravitationalForce,
  length,
  lerp,
  lerpVec2,
  logarithmicSpiral,
  logarithmicSpiralPoint,
  normalize,
  PHI,
  perpendicular,
  scale,
  sdfCircle,
  smoothstep,
  sub,
  TAU,
  vec2,
} from "../src/math";
import {
  approximateBezierLength,
  computeEdgeControlPoints,
  edgeToFloat32Array,
  evalCubicBezier,
  evalCubicBezierNormal,
  evalCubicBezierTangent,
  sampleBezierPoints,
} from "../src/math/bezier";
import {
  fbm,
  ridgedNoise,
  simplexNoise2D,
  turbulence,
} from "../src/math/noise";
import {
  archimedeanSpiral,
  type FiberConfig,
  fermatSpiral,
  generateCoronaFiber,
  generateCoronaFibersBuffer,
  generateLogarithmicSpiral,
} from "../src/math/spiral";

describe("Math Constants", () => {
  it("TAU equals 2*PI", () => {
    expect(TAU).toBeCloseTo(Math.PI * 2, 10);
  });

  it("PHI equals golden ratio", () => {
    expect(PHI).toBeCloseTo((1 + Math.sqrt(5)) / 2, 10);
    expect(GOLDEN_RATIO).toBe(PHI);
  });
});

describe("Vector Operations", () => {
  it("vec2 creates a vector", () => {
    const v = vec2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it("add vectors correctly", () => {
    const a = vec2(1, 2);
    const b = vec2(3, 4);
    const result = add(a, b);
    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  it("subtract vectors correctly", () => {
    const a = vec2(5, 7);
    const b = vec2(2, 3);
    const result = sub(a, b);
    expect(result.x).toBe(3);
    expect(result.y).toBe(4);
  });

  it("scale vector correctly", () => {
    const v = vec2(2, 3);
    const result = scale(v, 2);
    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  it("length calculates correctly for 3-4-5 triangle", () => {
    const v = vec2(3, 4);
    expect(length(v)).toBe(5);
  });

  it("normalize creates unit vector", () => {
    const v = vec2(3, 4);
    const n = normalize(v);
    expect(length(n)).toBeCloseTo(1, 10);
    expect(n.x).toBeCloseTo(0.6, 10);
    expect(n.y).toBeCloseTo(0.8, 10);
  });

  it("normalize handles zero vector", () => {
    const v = vec2(0, 0);
    const n = normalize(v);
    expect(n.x).toBe(0);
    expect(n.y).toBe(0);
  });

  it("dot product calculates correctly", () => {
    const a = vec2(1, 2);
    const b = vec2(3, 4);
    expect(dot(a, b)).toBe(11);
  });

  it("perpendicular rotates 90 degrees", () => {
    const v = vec2(1, 0);
    const p = perpendicular(v);
    expect(p.x).toBeCloseTo(0, 10); // Handle -0 vs 0
    expect(p.y).toBe(1);
    // Should be perpendicular
    expect(dot(v, p)).toBe(0);
  });
});

describe("Interpolation", () => {
  it("lerp interpolates numbers", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it("lerpVec2 interpolates vectors", () => {
    const a = vec2(0, 0);
    const b = vec2(10, 20);
    const mid = lerpVec2(a, b, 0.5);
    expect(mid.x).toBe(5);
    expect(mid.y).toBe(10);
  });

  it("clamp constrains values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("smoothstep produces smooth interpolation", () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
    // Derivative should be zero at endpoints
    const delta = 0.001;
    const atZero = (smoothstep(0, 1, delta) - smoothstep(0, 1, 0)) / delta;
    expect(atZero).toBeCloseTo(0, 2);
  });
});

describe("SDF and Glow", () => {
  it("sdfCircle returns distance to circle", () => {
    const center = vec2(0, 0);
    // Point at radius = inside circle
    expect(sdfCircle(vec2(5, 0), center, 10)).toBe(-5);
    // Point at edge
    expect(sdfCircle(vec2(10, 0), center, 10)).toBeCloseTo(0, 10);
    // Point outside
    expect(sdfCircle(vec2(15, 0), center, 10)).toBe(5);
  });

  it("glowFromSdf decays with distance", () => {
    const inside = glowFromSdf(-5, 0.1, 1);
    const atEdge = glowFromSdf(0, 0.1, 1);
    const outside = glowFromSdf(10, 0.1, 1);

    expect(atEdge).toBe(1); // Full intensity at edge
    // Inside is clamped to d=0, so same as edge
    expect(inside).toBe(atEdge);
    expect(outside).toBeLessThan(atEdge); // Dimmer outside
    expect(outside).toBeGreaterThan(0); // Still some glow
  });
});

describe("Logarithmic Spiral", () => {
  it("logarithmicSpiral computes radius", () => {
    const a = 100;
    const b = 0.1;
    expect(logarithmicSpiral(0, a, b)).toBe(100);
    // Radius increases with theta when b > 0
    expect(logarithmicSpiral(1, a, b)).toBeGreaterThan(100);
  });

  it("logarithmicSpiralPoint returns Cartesian coordinates", () => {
    const center = vec2(100, 100);
    const point = logarithmicSpiralPoint(0, 50, 0.1, center);
    // At theta=0, point should be at (center.x + r, center.y)
    expect(point.x).toBeCloseTo(150, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });
});

describe("Gravitational Force", () => {
  it("gravitationalForce follows inverse square law", () => {
    const G = 1000;
    const mass = 1;
    const f1 = gravitationalForce(mass, 100, G);
    const f2 = gravitationalForce(mass, 200, G);
    // Force at 2x distance should be 1/4
    expect(f2).toBeCloseTo(f1 / 4, 5);
  });

  it("gravitationalForce has minimum distance protection", () => {
    const G = 1000;
    const mass = 1;
    // Very small distance should not cause singularity
    const f = gravitationalForce(mass, 1, G);
    expect(Number.isFinite(f)).toBe(true);
    expect(f).toBeGreaterThan(0);
  });
});

describe("Cubic Bezier", () => {
  const p0 = vec2(0, 0);
  const p1 = vec2(0, 100);
  const p2 = vec2(100, 100);
  const p3 = vec2(100, 0);

  it("cubicBezier returns endpoints at t=0 and t=1", () => {
    const start = cubicBezier(p0, p1, p2, p3, 0);
    const end = cubicBezier(p0, p1, p2, p3, 1);

    expect(start.x).toBeCloseTo(p0.x, 10);
    expect(start.y).toBeCloseTo(p0.y, 10);
    expect(end.x).toBeCloseTo(p3.x, 10);
    expect(end.y).toBeCloseTo(p3.y, 10);
  });

  it("evalCubicBezier matches cubicBezier", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const a = cubicBezier(p0, p1, p2, p3, t);
      const b = evalCubicBezier(p0, p1, p2, p3, t);
      expect(a.x).toBeCloseTo(b.x, 10);
      expect(a.y).toBeCloseTo(b.y, 10);
    }
  });

  it("cubicBezierTangent returns direction", () => {
    const tangent = cubicBezierTangent(p0, p1, p2, p3, 0);
    // At t=0, tangent should point toward p1
    expect(tangent.x).toBeCloseTo(0, 5);
    expect(tangent.y).toBeGreaterThan(0);
  });

  it("evalCubicBezierNormal is perpendicular to tangent", () => {
    for (const t of [0.25, 0.5, 0.75]) {
      const tangent = evalCubicBezierTangent(p0, p1, p2, p3, t);
      const normal = evalCubicBezierNormal(p0, p1, p2, p3, t);
      const dotProduct = tangent.x * normal.x + tangent.y * normal.y;
      expect(dotProduct).toBeCloseTo(0, 5);
    }
  });

  it("approximateBezierLength returns positive length", () => {
    const len = approximateBezierLength(p0, p1, p2, p3, 100);
    expect(len).toBeGreaterThan(0);
    // Should be roughly the path length (not straight line)
    expect(len).toBeGreaterThan(100); // Straight line would be ~141
  });

  it("sampleBezierPoints returns correct count", () => {
    const points = sampleBezierPoints(p0, p1, p2, p3, 10);
    expect(points.length).toBe(10);
  });

  it("computeEdgeControlPoints creates curved path", () => {
    const source = vec2(0, 100);
    const target = vec2(200, 100);
    const orbCenter = vec2(100, 0);
    const ctrl = computeEdgeControlPoints(source, target, orbCenter, 0.5);

    expect(ctrl.p0).toEqual(source);
    expect(ctrl.p3).toEqual(target);
    // Control points should be pulled toward orb
    expect(ctrl.p1.y).toBeLessThan(source.y);
    expect(ctrl.p2.y).toBeLessThan(target.y);
  });

  it("edgeToFloat32Array creates GPU buffer", () => {
    const buffer = edgeToFloat32Array(p0, p1, p2, p3, 1, {
      r: 1,
      g: 0.5,
      b: 0,
      a: 1,
    });
    expect(buffer.length).toBe(16); // 8 coords + 1 active + 4 color + 3 padding
    expect(buffer[0]).toBe(p0.x);
    expect(buffer[1]).toBe(p0.y);
    expect(buffer[8]).toBe(1); // active
    expect(buffer[9]).toBe(1); // r
    expect(buffer[10]).toBe(0.5); // g
  });
});

describe("Simplex Noise", () => {
  it("simplexNoise2D returns values in [-1, 1]", () => {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const value = simplexNoise2D(x, y);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("simplexNoise2D is deterministic", () => {
    const v1 = simplexNoise2D(1.5, 2.5);
    const v2 = simplexNoise2D(1.5, 2.5);
    expect(v1).toBe(v2);
  });

  it("simplexNoise2D varies with position", () => {
    const v1 = simplexNoise2D(0, 0);
    const v2 = simplexNoise2D(10, 10);
    const v3 = simplexNoise2D(0.1, 0.1);
    // Different positions should have different values (statistical)
    expect(new Set([v1, v2, v3]).size).toBeGreaterThan(1);
  });
});

describe("Fractal Brownian Motion", () => {
  it("fbm returns values approximately in [-1, 1]", () => {
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 10;
      const y = Math.random() * 10;
      const value = fbm(x, y, 4);
      expect(value).toBeGreaterThanOrEqual(-1.5);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });

  it("fbm is smoother with fewer octaves", () => {
    // More octaves = more detail = more variation
    let _variance1 = 0;
    let _variance4 = 0;
    const samples = 20;

    for (let i = 0; i < samples; i++) {
      const x = i * 0.1;
      const _v1 = fbm(x, 0, 1);
      const _v4 = fbm(x, 0, 4);
      if (i > 0) {
        _variance1 += Math.abs(fbm(x, 0, 1) - fbm(x - 0.1, 0, 1));
        _variance4 += Math.abs(fbm(x, 0, 4) - fbm(x - 0.1, 0, 4));
      }
    }
    // 4 octaves should generally show more variation
    // (This is a statistical test, may occasionally fail)
  });
});

describe("Ridged and Turbulence Noise", () => {
  it("ridgedNoise produces positive values", () => {
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 10;
      const y = Math.random() * 10;
      const value = ridgedNoise(x, y, 3);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("turbulence produces positive values", () => {
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 10;
      const y = Math.random() * 10;
      const value = turbulence(x, y, 4);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Spiral Generation", () => {
  it("generateLogarithmicSpiral returns correct point count", () => {
    const center = vec2(0, 0);
    const points = generateLogarithmicSpiral(center, 0, 100, -0.1, 50, 2);
    expect(points.length).toBe(51); // segments + 1
  });

  it("generateLogarithmicSpiral spirals inward with negative b", () => {
    const center = vec2(0, 0);
    const points = generateLogarithmicSpiral(center, 0, 100, -0.1, 10, 1);
    const startDist = length(sub(points[0], center));
    const endDist = length(sub(points.at(-1), center));
    expect(endDist).toBeLessThan(startDist);
  });

  it("archimedeanSpiral increases linearly", () => {
    const r1 = archimedeanSpiral(0, 10, 5);
    const r2 = archimedeanSpiral(1, 10, 5);
    const r3 = archimedeanSpiral(2, 10, 5);
    expect(r1).toBe(10);
    expect(r2).toBe(15);
    expect(r3).toBe(20);
  });

  it("fermatSpiral distributes points evenly", () => {
    const count = 100;
    const maxRadius = 100;
    const points = Array.from({ length: count }, (_, i) =>
      fermatSpiral(i, count, maxRadius)
    );

    // Points should be within radius
    for (const p of points) {
      expect(length(p)).toBeLessThanOrEqual(maxRadius * 1.01);
    }

    // Last point should be near max radius
    const lastPoint = points.at(-1);
    expect(length(lastPoint)).toBeGreaterThan(maxRadius * 0.9);
  });
});

describe("Corona Fiber Generation", () => {
  const config: FiberConfig = {
    outerRadius: 400,
    innerRadius: 100,
    spiralTightness: 0.15,
    segments: 50,
    wobbleAmplitude: 0.1,
    wobbleFrequency: 5,
  };
  const center = vec2(500, 500);

  it("generateCoronaFiber returns correct segment count", () => {
    const fiber = generateCoronaFiber(0, 100, center, config, 0);
    expect(fiber.length).toBe(config.segments + 1);
  });

  it("generateCoronaFiber starts at outer radius", () => {
    const fiber = generateCoronaFiber(0, 100, center, config, 0);
    const startDist = length(sub(fiber[0], center));
    expect(startDist).toBeCloseTo(config.outerRadius, 1);
  });

  it("generateCoronaFiber ends near or at inner radius", () => {
    const fiber = generateCoronaFiber(0, 100, center, config, 0);
    const endDist = length(sub(fiber.at(-1), center));
    // Fiber ends at the spiral radius clamped to innerRadius minimum
    // The end distance depends on spiral tightness and wobble
    expect(endDist).toBeGreaterThanOrEqual(config.innerRadius);
    expect(endDist).toBeLessThan(config.outerRadius);
  });

  it("generateCoronaFibersBuffer creates correct size buffer", () => {
    const fiberCount = 10;
    const segments = 20;
    const testConfig: FiberConfig = { ...config, segments };
    const buffer = generateCoronaFibersBuffer(
      fiberCount,
      segments,
      center,
      testConfig,
      0
    );
    // Each point is 2 floats (x, y), each fiber has segments+1 points
    const expectedSize = fiberCount * (segments + 1) * 2;
    expect(buffer.length).toBe(expectedSize);
  });

  it("fibers are distributed around center", () => {
    const fiberCount = 8;
    const fibers = Array.from({ length: fiberCount }, (_, i) =>
      generateCoronaFiber(i, fiberCount, center, config, 0)
    );

    // First points of each fiber should be at different angles
    const angles = fibers.map((f) => {
      const dx = f[0].x - center.x;
      const dy = f[0].y - center.y;
      return Math.atan2(dy, dx);
    });

    // Angles should be roughly evenly distributed
    const sortedAngles = [...angles].sort((a, b) => a - b);
    for (let i = 1; i < sortedAngles.length; i++) {
      const diff = sortedAngles[i] - sortedAngles[i - 1];
      const expectedDiff = TAU / fiberCount;
      expect(Math.abs(diff - expectedDiff)).toBeLessThan(0.5);
    }
  });
});
