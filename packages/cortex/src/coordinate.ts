/**
 * 4D Coordinate System
 *
 * Unified coordinate system with:
 * - X, Y: Screen space
 * - Z: Depth (parallax/z-ordering)
 * - T: Time (state evolution, history)
 * - S: Semantic embedding (knowledge graph)
 */

import type { Camera, Point4D, Vec2 } from "./types";

import { lerp } from "./math";

/**
 * Temporal state for time dimension
 */
export interface TemporalState {
  currentTime: number;
  historyWindow: number; // How far back to keep state
  states: Map<string, Point4D[]>; // Entity ID -> state history
}

/**
 * Create initial temporal state
 */
export function createTemporalState(historyWindow = 60_000): TemporalState {
  return {
    currentTime: Date.now(),
    historyWindow,
    states: new Map(),
  };
}

/**
 * Record a point in time for an entity
 */
export function recordState(
  temporal: TemporalState,
  entityId: string,
  point: Point4D
): void {
  const history = temporal.states.get(entityId) ?? [];
  history.push({ ...point, t: Date.now() });

  // Prune old states
  const cutoff = Date.now() - temporal.historyWindow;
  const pruned = history.filter((p) => p.t >= cutoff);

  temporal.states.set(entityId, pruned);
}

/**
 * Linear interpolation between two 4D points
 */
export function lerpPoint4D(a: Point4D, b: Point4D, t: number): Point4D {
  // Interpolate semantic embedding if same dimensions
  const s: number[] = [];
  const minLen = Math.min(a.s.length, b.s.length);
  for (let i = 0; i < minLen; i++) {
    s.push(lerp(a.s[i] ?? 0, b.s[i] ?? 0, t));
  }

  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    t: lerp(a.t, b.t, t),
    s,
  };
}

/**
 * Find bracketing states for time interpolation
 */
export function findBracketingStates(
  history: Point4D[],
  targetTime: number
): [Point4D, Point4D] {
  if (history.length === 0) {
    throw new Error("Cannot interpolate empty history");
  }

  const first = history[0];
  if (!first) {
    throw new Error("Cannot interpolate empty history");
  }

  if (history.length === 1) {
    return [first, first];
  }

  // Find states bracketing target time
  let before = first;
  let after = history.at(-1);
  if (!after) {
    throw new Error("History corrupted");
  }

  for (let i = 0; i < history.length - 1; i++) {
    const curr = history[i];
    const next = history[i + 1];
    if (curr && next && curr.t <= targetTime && next.t >= targetTime) {
      before = curr;
      after = next;
      break;
    }
  }

  return [before, after];
}

/**
 * Interpolate state at any point in time
 */
export function interpolateTemporal(
  history: Point4D[],
  targetTime: number
): Point4D {
  const [before, after] = findBracketingStates(history, targetTime);

  if (before.t === after.t) {
    return before;
  }

  const t = (targetTime - before.t) / (after.t - before.t);
  return lerpPoint4D(before, after, t);
}

/**
 * Project semantic embedding to 2D offset
 *
 * Uses a basis matrix (2xN) to project N-dimensional semantics to screen offset.
 * This enables "semantic space" visualization where similar concepts cluster.
 */
export function projectSemanticToXY(
  embedding: number[],
  basis: Float32Array
): Vec2 {
  const n = embedding.length;
  let x = 0;
  let y = 0;

  // basis is 2xN stored row-major: [bx0, bx1, ..., bxN, by0, by1, ..., byN]
  for (let i = 0; i < n; i++) {
    const e = embedding[i] ?? 0;
    x += e * (basis[i] ?? 0);
    y += e * (basis[n + i] ?? 0);
  }

  return { x, y };
}

/**
 * Project 4D point to screen coordinates
 */
export function projectToScreen(point: Point4D, camera: Camera): Vec2 {
  // Perspective projection with depth
  const perspectiveScale = 1 / (1 + point.z * camera.depthFactor);

  // Semantic-influenced position
  const semanticOffset = projectSemanticToXY(point.s, camera.semanticBasis);

  // Apply zoom
  const zoomedX = point.x * camera.zoom;
  const zoomedY = point.y * camera.zoom;

  return {
    x: (zoomedX + semanticOffset.x) * perspectiveScale + camera.center.x,
    y: (zoomedY + semanticOffset.y) * perspectiveScale + camera.center.y,
  };
}

/**
 * Create default camera
 */
export function createCamera(
  center: Vec2,
  zoom = 1,
  embeddingDimensions = 128
): Camera {
  // Create random semantic basis (would normally be learned/PCA)
  const basis = new Float32Array(embeddingDimensions * 2);
  for (let i = 0; i < basis.length; i++) {
    basis[i] = (Math.random() - 0.5) * 0.1;
  }

  return {
    center,
    zoom,
    depthFactor: 0.001, // Subtle parallax
    semanticBasis: basis,
  };
}

/**
 * Create a Point4D from basic coordinates
 */
export function point4D(
  x: number,
  y: number,
  z = 0,
  t = Date.now(),
  s: number[] = []
): Point4D {
  return { x, y, z, t, s };
}

/**
 * Convert screen coordinates to world space
 */
export function screenToWorld(screen: Vec2, camera: Camera): Vec2 {
  return {
    x: (screen.x - camera.center.x) / camera.zoom,
    y: (screen.y - camera.center.y) / camera.zoom,
  };
}

/**
 * Compute depth from node type and state
 *
 * Focused nodes come forward (z=0), others recede based on distance from focus.
 */
export function computeNodeDepth(
  isFocused: boolean,
  distanceFromFocus: number,
  maxDistance: number
): number {
  if (isFocused) {
    return 0;
  }
  return Math.min(1, distanceFromFocus / maxDistance) * 0.5;
}

/**
 * Generate semantic basis from PCA of embeddings
 *
 * For visualization, we project high-dimensional embeddings to 2D.
 * This is a simple random projection; a real implementation would use PCA/UMAP.
 */
export function computeSemanticBasis(
  _embeddings: number[][],
  dimensions: number
): Float32Array {
  const basis = new Float32Array(dimensions * 2);

  // Simple random projection (stable)
  // In production, use PCA on the embeddings
  const seed = 42;
  let state = seed;
  for (let i = 0; i < basis.length; i++) {
    state = (state * 1_103_515_245 + 12_345) & 0x7F_FF_FF_FF;
    basis[i] = (state / 0x7F_FF_FF_FF - 0.5) * 2;
  }

  // Normalize rows
  let sumX = 0,
    sumY = 0;
  for (let i = 0; i < dimensions; i++) {
    const bx = basis[i] ?? 0;
    const by = basis[dimensions + i] ?? 0;
    sumX += bx * bx;
    sumY += by * by;
  }
  const normX = Math.sqrt(sumX);
  const normY = Math.sqrt(sumY);
  for (let i = 0; i < dimensions; i++) {
    basis[i] = (basis[i] ?? 0) / normX;
    basis[dimensions + i] = (basis[dimensions + i] ?? 0) / normY;
  }

  return basis;
}
