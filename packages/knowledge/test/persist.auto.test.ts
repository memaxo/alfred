import { describe, expect, test } from "bun:test";

import { empty, fact } from "../src/hypergraph.js";
import { startAutoPersist, type PersistFn } from "../src/persist.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("startAutoPersist", () => {
  test("flushes dirty nodes on interval", async () => {
    const graph = empty();
    graph.add(fact("alpha", 0.9, "unit"));
    let persisted = 0;
    const persist: PersistFn = async (_resource, entries) => {
      persisted += entries.length;
    };

    const handle = startAutoPersist(graph, "resource", persist, {
      intervalMs: 5,
      batchSize: 1,
      computeEmbeddings: false,
    });

    await wait(25);
    handle.stop();

    expect(persisted).toBe(1);
    expect(graph.getDirty()).toHaveLength(0);
  });

  test("computes embeddings for facts", async () => {
    const graph = empty();
    const nodeId = graph.add(fact("beta content", 0.85, "unit"));

    const handle = startAutoPersist(
      graph,
      "resource",
      async () => {},
      {
        intervalMs: 5,
        embedBatchSize: 1,
        embedder: {
          embed: async (text) => {
            const base = text.length;
            const vec = new Float32Array(1024);
            vec.fill(base);
            return vec;
          },
        },
      }
    );

    await wait(25);
    handle.stop();

    expect(graph.getEmbedding(nodeId)).toBeDefined();
  });
});
