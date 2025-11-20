import { describe, expect, it } from "bun:test";

import { cosineSim, knn } from "../src/indices/knn";
import { nodeFromHash } from "../src/hypergraph";

describe("knn", () => {
  it("computes cosine similarity", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSim(a, b)).toBeCloseTo(1);
  });

  it("returns top-k vectors", () => {
    const ids = ["a", "b", "c"].map((hash) => nodeFromHash(hash));
    const query = new Float32Array([1, 0]);
    const vectors = [
      { id: ids[0], vec: new Float32Array([1, 0]) },
      { id: ids[1], vec: new Float32Array([0, 1]) },
      { id: ids[2], vec: new Float32Array([0.5, 0.5]) },
    ];

    const results = knn(vectors, query, 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toBe(ids[0]);
    expect(results[1]).toBe(ids[2]);
  });
});
