import { describe, expect, test } from "bun:test";

import { RTreeND, type HyperRect } from "../src/indices/rtree.js";
import type { NodeId } from "../src/hypergraph.js";

const node = (value: string): NodeId => value as NodeId;

const rect = (min: number[], max: number[]): HyperRect => ({
  min: new Float32Array(min),
  max: new Float32Array(max),
});

describe("RTreeND", () => {
  test("enforces dimensions on point insert", () => {
    const tree = new RTreeND(3, 8);
    const vec = new Float32Array([1, 2, 3, 4]);
    expect(() => tree.insertPoint(vec, node("a"))).toThrow(
      "rtree_dim_mismatch_3"
    );
  });

  test("range search returns intersecting ids", () => {
    const tree = new RTreeND(4, 8);
    tree.insertPoint(new Float32Array([0, 0, 0, 0]), node("a"));
    tree.insertPoint(new Float32Array([5, 5, 5, 5]), node("b"));
    tree.insertPoint(new Float32Array([2, 2, 2, 2]), node("c"));

    const hits = tree.search(rect([0, 0, 0, 0], [3, 3, 3, 3]));
    expect(hits.sort()).toEqual([node("a"), node("c")].sort());
  });

  test("nearestK orders by euclidean distance", () => {
    const tree = new RTreeND(2, 6);
    tree.insertPoint(new Float32Array([0, 0]), node("p"));
    tree.insertPoint(new Float32Array([10, 0]), node("q"));
    tree.insertPoint(new Float32Array([3, 4]), node("r"));

    const neighbors = tree.nearestK(new Float32Array([1, 1]), 2);
    expect(neighbors.map((n) => n.id)).toEqual([node("p"), node("r")]);
    expect(neighbors[0]!.dist).toBeCloseTo(Math.sqrt(2));
  });

  test("remove deletes existing ids", () => {
    const tree = new RTreeND(2, 6);
    tree.insertPoint(new Float32Array([0, 0]), node("x"));
    tree.insertPoint(new Float32Array([1, 1]), node("y"));
    expect(tree.remove(node("x"))).toBe(true);
    const hits = tree.search(rect([-1, -1], [2, 2]));
    expect(hits).toEqual([node("y")]);
  });
});
