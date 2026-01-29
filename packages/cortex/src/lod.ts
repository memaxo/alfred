/**
 * Level of Detail (LOD) System
 *
 * Dynamically adjusts rendering complexity based on zoom level
 * and viewport to maintain 60fps performance.
 */

import type { LODLevel, Rect, Vec2 } from "./types";

/**
 * LOD thresholds and particle/fiber counts
 */
const LOD_CONFIG = {
  /** Zoom level thresholds */
  thresholds: [0.3, 0.6, 1, 2] as const,

  /** Particle counts per LOD level */
  particles: [500, 1500, 3000, 5000, 8000] as const,

  /** Corona fiber counts per LOD level */
  fibers: [200, 500, 1000, 2000, 3000] as const,

  /** Edge particles per LOD level */
  edgeParticles: [20, 50, 100, 200, 400] as const,

  /** Segments per corona fiber per LOD level */
  fiberSegments: [10, 20, 35, 50, 75] as const,
} as const;

function at<T>(arr: readonly T[], idx: number): T {
  const n = arr.length;
  if (n === 0) {
    throw new Error("Empty LOD config");
  }
  const i = idx < 0 ? 0 : (idx >= n ? n - 1 : idx);
  return arr[i]!;
}

/**
 * Compute LOD level from zoom
 */
export function computeLOD(zoom: number): LODLevel {
  let level = 0;

  for (let i = 0; i < LOD_CONFIG.thresholds.length; i++) {
    const th = LOD_CONFIG.thresholds[i];
    if (th !== undefined && zoom >= th) {
      level = i + 1;
    }
  }

  return {
    particles: at(LOD_CONFIG.particles, level),
    fibers: at(LOD_CONFIG.fibers, level),
    edgeParticles: at(LOD_CONFIG.edgeParticles, level),
  };
}

/**
 * Get fiber segment count for current LOD
 */
export function getFiberSegments(zoom: number): number {
  let level = 0;

  for (let i = 0; i < LOD_CONFIG.thresholds.length; i++) {
    const th = LOD_CONFIG.thresholds[i];
    if (th !== undefined && zoom >= th) {
      level = i + 1;
    }
  }

  return at(LOD_CONFIG.fiberSegments, level);
}

/**
 * LOD Manager
 *
 * Tracks zoom changes and signals when LOD needs updating.
 */
export class LODManager {
  private currentZoom = 1;
  private currentLOD: LODLevel;
  private readonly listeners: Set<(lod: LODLevel) => void> = new Set();

  constructor() {
    this.currentLOD = computeLOD(1);
  }

  /**
   * Update zoom level
   * @returns true if LOD changed
   */
  setZoom(zoom: number): boolean {
    const newLOD = computeLOD(zoom);
    const changed =
      newLOD.particles !== this.currentLOD.particles ||
      newLOD.fibers !== this.currentLOD.fibers ||
      newLOD.edgeParticles !== this.currentLOD.edgeParticles;

    this.currentZoom = zoom;

    if (changed) {
      this.currentLOD = newLOD;
      for (const listener of this.listeners) {
        listener(newLOD);
      }
    }

    return changed;
  }

  /**
   * Get current LOD level
   */
  getLOD(): LODLevel {
    return this.currentLOD;
  }

  /**
   * Get current zoom
   */
  getZoom(): number {
    return this.currentZoom;
  }

  /**
   * Subscribe to LOD changes
   */
  subscribe(callback: (lod: LODLevel) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

/**
 * Spatial Index for viewport culling
 *
 * Grid-based spatial partitioning for efficient visibility queries.
 */
export class SpatialIndex<T extends { position: Vec2 }> {
  private readonly cellSize: number;
  private readonly grid: Map<string, T[]> = new Map();

  constructor(cellSize = 200) {
    this.cellSize = cellSize;
  }

  /**
   * Hash position to cell key
   */
  private cellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  /**
   * Insert an item
   */
  insert(item: T): void {
    const key = this.cellKey(item.position.x, item.position.y);
    const cell = this.grid.get(key) ?? [];
    cell.push(item);
    this.grid.set(key, cell);
  }

  /**
   * Remove an item
   */
  remove(item: T): void {
    const key = this.cellKey(item.position.x, item.position.y);
    const cell = this.grid.get(key);
    if (cell) {
      const index = cell.indexOf(item);
      if (index !== -1) {
        cell.splice(index, 1);
      }
    }
  }

  /**
   * Query items within viewport
   */
  queryViewport(viewport: Rect): T[] {
    const results: T[] = [];

    const minCellX = Math.floor(viewport.x / this.cellSize);
    const minCellY = Math.floor(viewport.y / this.cellSize);
    const maxCellX = Math.floor((viewport.x + viewport.width) / this.cellSize);
    const maxCellY = Math.floor((viewport.y + viewport.height) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const item of cell) {
            // Fine-grained check
            if (
              item.position.x >= viewport.x &&
              item.position.x <= viewport.x + viewport.width &&
              item.position.y >= viewport.y &&
              item.position.y <= viewport.y + viewport.height
            ) {
              results.push(item);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Rebuild from array of items
   */
  rebuild(items: T[]): void {
    this.clear();
    for (const item of items) {
      this.insert(item);
    }
  }
}

/**
 * Frustum culling helper
 *
 * Check if a circle is visible in viewport.
 */
export function isCircleInViewport(
  center: Vec2,
  radius: number,
  viewport: Rect
): boolean {
  // Closest point on rect to circle center
  const closestX = Math.max(
    viewport.x,
    Math.min(center.x, viewport.x + viewport.width)
  );
  const closestY = Math.max(
    viewport.y,
    Math.min(center.y, viewport.y + viewport.height)
  );

  // Distance from closest point to center
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  const distanceSquared = dx * dx + dy * dy;

  return distanceSquared <= radius * radius;
}

/**
 * Edge culling helper
 *
 * Check if a bezier curve might be visible in viewport.
 * Uses bounding box of control points for quick rejection.
 */
export function isEdgeInViewport(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  viewport: Rect
): boolean {
  // Compute bounding box of control points
  const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
  const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
  const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
  const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);

  // Check AABB intersection
  return !(
    maxX < viewport.x ||
    minX > viewport.x + viewport.width ||
    maxY < viewport.y ||
    minY > viewport.y + viewport.height
  );
}
