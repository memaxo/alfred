import { describe, expect, it } from "bun:test";

import {
  debounce,
  filterEdgesByZoom,
  getEdgeVisibility,
  throttle,
} from "../performance";

describe("getEdgeVisibility", () => {
  it("hides all edges at tiny zoom (< 0.3)", () => {
    const result = getEdgeVisibility(0.2);
    expect(result.showEdges).toBe(false);
    expect(result.showLabels).toBe(false);
    expect(result.filterImportant).toBe(false);
  });

  it("shows only important edges at small zoom (0.3-0.6)", () => {
    const result = getEdgeVisibility(0.4);
    expect(result.showEdges).toBe(true);
    expect(result.showLabels).toBe(false);
    expect(result.filterImportant).toBe(true);
  });

  it("shows all edges with labels at full zoom (>= 0.6)", () => {
    const result = getEdgeVisibility(0.8);
    expect(result.showEdges).toBe(true);
    expect(result.showLabels).toBe(true);
    expect(result.filterImportant).toBe(false);
  });

  it("handles boundary at 0.3", () => {
    const below = getEdgeVisibility(0.29);
    const at = getEdgeVisibility(0.3);

    expect(below.showEdges).toBe(false);
    expect(at.showEdges).toBe(true);
  });

  it("handles boundary at 0.6", () => {
    const below = getEdgeVisibility(0.59);
    const at = getEdgeVisibility(0.6);

    expect(below.showLabels).toBe(false);
    expect(at.showLabels).toBe(true);
  });
});

describe("filterEdgesByZoom", () => {
  const edges = [
    { id: "e1", data: { kind: "blocks" } },
    { id: "e2", data: { kind: "depends_on" } },
    { id: "e3", data: { kind: "relates_to" } },
    { id: "e4", data: { kind: "contains" } },
    { id: "e5", data: { kind: "data_flow" } },
  ];

  it("returns empty array at tiny zoom", () => {
    const result = filterEdgesByZoom(edges, 0.2);
    expect(result).toHaveLength(0);
  });

  it("returns only important edges at small zoom", () => {
    const result = filterEdgesByZoom(edges, 0.4);
    expect(result).toHaveLength(3); // blocks, depends_on, contains
    expect(result.map((e) => e.id)).toContain("e1");
    expect(result.map((e) => e.id)).toContain("e2");
    expect(result.map((e) => e.id)).toContain("e4");
  });

  it("returns all edges at full zoom", () => {
    const result = filterEdgesByZoom(edges, 0.8);
    expect(result).toHaveLength(5);
  });

  it("handles edges without kind", () => {
    const edgesWithoutKind = [
      { id: "e1", data: {} },
      { id: "e2", data: { kind: "blocks" } },
    ];
    const result = filterEdgesByZoom(edgesWithoutKind, 0.4);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("e2");
  });
});

describe("debounce", () => {
  it("delays function execution", async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    fn();
    fn();

    expect(callCount).toBe(0);
    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });

  it("resets delay on subsequent calls", async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();
    await new Promise((r) => setTimeout(r, 100));

    expect(callCount).toBe(1);
  });
});

describe("throttle", () => {
  it("executes immediately on first call", () => {
    let callCount = 0;
    const fn = throttle(() => {
      callCount++;
    }, 100);

    fn();
    expect(callCount).toBe(1);
  });

  it("limits execution rate", async () => {
    let callCount = 0;
    const fn = throttle(() => {
      callCount++;
    }, 50);

    fn(); // Immediate
    fn(); // Throttled
    fn(); // Throttled

    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(2); // Trailing call
  });
});
