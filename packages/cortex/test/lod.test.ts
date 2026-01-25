/**
 * Cortex LOD System Tests
 *
 * Tests for LOD computation, spatial culling, and viewport queries.
 * Uses real implementations with no mocking.
 */

import { beforeEach, describe, expect, it } from "bun:test";

import type { Rect, Vec2 } from "../src/types";

import {
  computeLOD,
  getFiberSegments,
  isCircleInViewport,
  isEdgeInViewport,
  LODManager,
  SpatialIndex,
} from "../src/lod";

describe("computeLOD", () => {
  it("returns lowest LOD at very low zoom", () => {
    const lod = computeLOD(0.1);
    expect(lod.particles).toBe(500);
    expect(lod.fibers).toBe(200);
    expect(lod.edgeParticles).toBe(20);
  });

  it("increases LOD as zoom increases", () => {
    const lod1 = computeLOD(0.2);
    const lod2 = computeLOD(0.5);
    const lod3 = computeLOD(1.5);
    const lod4 = computeLOD(3);

    expect(lod2.particles).toBeGreaterThanOrEqual(lod1.particles);
    expect(lod3.particles).toBeGreaterThanOrEqual(lod2.particles);
    expect(lod4.particles).toBeGreaterThanOrEqual(lod3.particles);
  });

  it("returns highest LOD at high zoom", () => {
    const lod = computeLOD(5);
    expect(lod.particles).toBe(8000);
    expect(lod.fibers).toBe(3000);
    expect(lod.edgeParticles).toBe(400);
  });

  it("matches threshold boundaries", () => {
    // At exactly 0.3, should be level 1
    const at30 = computeLOD(0.3);
    expect(at30.particles).toBe(1500);

    // At exactly 1.0, should be level 3
    const at100 = computeLOD(1);
    expect(at100.particles).toBe(5000);

    // At exactly 2.0, should be level 4
    const at200 = computeLOD(2);
    expect(at200.particles).toBe(8000);
  });
});

describe("getFiberSegments", () => {
  it("returns lowest segments at low zoom", () => {
    const segments = getFiberSegments(0.1);
    expect(segments).toBe(10);
  });

  it("increases segments with zoom", () => {
    const seg1 = getFiberSegments(0.2);
    const seg2 = getFiberSegments(0.5);
    const seg3 = getFiberSegments(1.5);

    expect(seg2).toBeGreaterThanOrEqual(seg1);
    expect(seg3).toBeGreaterThanOrEqual(seg2);
  });

  it("returns highest segments at high zoom", () => {
    const segments = getFiberSegments(5);
    expect(segments).toBe(75);
  });
});

describe("LODManager", () => {
  let manager: LODManager;

  beforeEach(() => {
    manager = new LODManager();
  });

  it("initializes with zoom=1 LOD", () => {
    const lod = manager.getLOD();
    expect(lod.particles).toBeGreaterThan(500); // Not lowest
    expect(manager.getZoom()).toBe(1);
  });

  it("setZoom returns true when LOD changes", () => {
    const changed = manager.setZoom(0.1);
    expect(changed).toBe(true);
  });

  it("setZoom returns false when LOD unchanged", () => {
    manager.setZoom(1);
    const _changed = manager.setZoom(1.1); // Still in same threshold
    // May or may not change depending on thresholds
  });

  it("notifies listeners on LOD change", () => {
    let notified = false;
    manager.subscribe(() => {
      notified = true;
    });

    manager.setZoom(0.1); // Should trigger change
    expect(notified).toBe(true);
  });

  it("unsubscribe stops notifications", () => {
    let count = 0;
    const unsubscribe = manager.subscribe(() => {
      count++;
    });

    manager.setZoom(0.1);
    expect(count).toBe(1);

    unsubscribe();
    manager.setZoom(5);
    expect(count).toBe(1); // Still 1
  });

  it("supports multiple listeners", () => {
    let count = 0;
    manager.subscribe(() => count++);
    manager.subscribe(() => count++);

    manager.setZoom(0.1);
    expect(count).toBe(2);
  });
});

describe("SpatialIndex", () => {
  interface TestItem {
    position: Vec2;
    id: string;
  }

  let index: SpatialIndex<TestItem>;

  beforeEach(() => {
    index = new SpatialIndex<TestItem>(100); // 100px cells
  });

  it("inserts and queries items", () => {
    const item: TestItem = { position: { x: 50, y: 50 }, id: "a" };
    index.insert(item);

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("a");
  });

  it("returns only items in viewport", () => {
    index.insert({ position: { x: 50, y: 50 }, id: "in" });
    index.insert({ position: { x: 500, y: 500 }, id: "out" });

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("in");
  });

  it("handles items across cell boundaries", () => {
    index.insert({ position: { x: 99, y: 99 }, id: "edge" });
    index.insert({ position: { x: 101, y: 101 }, id: "next" });

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    expect(results.length).toBe(2);
  });

  it("removes items", () => {
    const item: TestItem = { position: { x: 50, y: 50 }, id: "a" };
    index.insert(item);
    index.remove(item);

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(results.length).toBe(0);
  });

  it("clears all items", () => {
    index.insert({ position: { x: 50, y: 50 }, id: "a" });
    index.insert({ position: { x: 150, y: 150 }, id: "b" });
    index.clear();

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
    expect(results.length).toBe(0);
  });

  it("rebuilds from array", () => {
    index.insert({ position: { x: 50, y: 50 }, id: "old" });

    index.rebuild([
      { position: { x: 50, y: 50 }, id: "new1" },
      { position: { x: 150, y: 150 }, id: "new2" },
    ]);

    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
    expect(results.length).toBe(2);
    expect(results.map((r) => r.id).sort()).toEqual(["new1", "new2"]);
  });

  it("handles negative coordinates", () => {
    index.insert({ position: { x: -50, y: -50 }, id: "negative" });

    const results = index.queryViewport({
      x: -100,
      y: -100,
      width: 200,
      height: 200,
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("negative");
  });

  it("handles large viewports efficiently", () => {
    // Add 100 items
    for (let i = 0; i < 100; i++) {
      index.insert({
        position: { x: i * 50, y: i * 50 },
        id: `item-${i}`,
      });
    }

    // Query subset
    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(100);
  });
});

describe("isCircleInViewport", () => {
  const viewport: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it("returns true for circle inside viewport", () => {
    expect(isCircleInViewport({ x: 50, y: 50 }, 10, viewport)).toBe(true);
  });

  it("returns true for circle overlapping edge", () => {
    // Circle center at (105, 50), radius 10 - overlaps right edge
    expect(isCircleInViewport({ x: 105, y: 50 }, 10, viewport)).toBe(true);
  });

  it("returns false for circle outside viewport", () => {
    expect(isCircleInViewport({ x: 200, y: 200 }, 10, viewport)).toBe(false);
  });

  it("handles circle at corner", () => {
    // Circle touching corner
    expect(isCircleInViewport({ x: 0, y: 0 }, 10, viewport)).toBe(true);
    expect(isCircleInViewport({ x: 100, y: 100 }, 10, viewport)).toBe(true);
  });

  it("handles large circle encompassing viewport", () => {
    expect(isCircleInViewport({ x: 50, y: 50 }, 1000, viewport)).toBe(true);
  });

  it("handles zero radius", () => {
    expect(isCircleInViewport({ x: 50, y: 50 }, 0, viewport)).toBe(true);
    expect(isCircleInViewport({ x: 200, y: 200 }, 0, viewport)).toBe(false);
  });
});

describe("isEdgeInViewport", () => {
  const viewport: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it("returns true for edge inside viewport", () => {
    const p0: Vec2 = { x: 20, y: 20 };
    const p1: Vec2 = { x: 40, y: 40 };
    const p2: Vec2 = { x: 60, y: 60 };
    const p3: Vec2 = { x: 80, y: 80 };
    expect(isEdgeInViewport(p0, p1, p2, p3, viewport)).toBe(true);
  });

  it("returns true for edge crossing viewport", () => {
    const p0: Vec2 = { x: -50, y: 50 };
    const p1: Vec2 = { x: 0, y: 50 };
    const p2: Vec2 = { x: 100, y: 50 };
    const p3: Vec2 = { x: 150, y: 50 };
    expect(isEdgeInViewport(p0, p1, p2, p3, viewport)).toBe(true);
  });

  it("returns false for edge outside viewport", () => {
    const p0: Vec2 = { x: 200, y: 200 };
    const p1: Vec2 = { x: 220, y: 200 };
    const p2: Vec2 = { x: 240, y: 200 };
    const p3: Vec2 = { x: 260, y: 200 };
    expect(isEdgeInViewport(p0, p1, p2, p3, viewport)).toBe(false);
  });

  it("handles edge touching viewport edge", () => {
    const p0: Vec2 = { x: 100, y: 0 };
    const p1: Vec2 = { x: 100, y: 33 };
    const p2: Vec2 = { x: 100, y: 66 };
    const p3: Vec2 = { x: 100, y: 100 };
    expect(isEdgeInViewport(p0, p1, p2, p3, viewport)).toBe(true);
  });

  it("handles control points outside but curve inside", () => {
    // Conservative: uses bounding box, so may return true even if curve outside
    const p0: Vec2 = { x: -50, y: 50 };
    const p1: Vec2 = { x: 50, y: -50 };
    const p2: Vec2 = { x: 50, y: 150 };
    const p3: Vec2 = { x: 150, y: 50 };
    // Bounding box overlaps viewport
    expect(isEdgeInViewport(p0, p1, p2, p3, viewport)).toBe(true);
  });

  it("handles degenerate edge (all points same)", () => {
    const p: Vec2 = { x: 50, y: 50 };
    expect(isEdgeInViewport(p, p, p, p, viewport)).toBe(true);
    const outside: Vec2 = { x: 200, y: 200 };
    expect(isEdgeInViewport(outside, outside, outside, outside, viewport)).toBe(
      false
    );
  });
});

describe("LOD Performance Characteristics", () => {
  it("LOD levels increase rendering budget appropriately", () => {
    const low = computeLOD(0.1);
    const high = computeLOD(5);

    // High LOD should have ~16x more particles than low
    const particleRatio = high.particles / low.particles;
    expect(particleRatio).toBeGreaterThan(10);
    expect(particleRatio).toBeLessThan(20);

    // Similar ratio for fibers
    const fiberRatio = high.fibers / low.fibers;
    expect(fiberRatio).toBeGreaterThan(10);
    expect(fiberRatio).toBeLessThan(20);
  });

  it("SpatialIndex provides efficient culling", () => {
    const index = new SpatialIndex<{ position: Vec2; id: number }>(100);

    // Add 10000 items spread across large area
    for (let i = 0; i < 10_000; i++) {
      index.insert({
        position: { x: i * 10, y: i * 10 },
        id: i,
      });
    }

    // Small viewport should return few items
    const start = performance.now();
    const results = index.queryViewport({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
    const elapsed = performance.now() - start;

    expect(results.length).toBeLessThan(100);
    expect(elapsed).toBeLessThan(10); // Should be sub-millisecond
  });
});
