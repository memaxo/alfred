import { describe, expect, it, vi } from "bun:test";

import {
  empty,
  fact,
  type Knowledge,
  knowledgeHash,
  nodeFromHash,
  relation,
  timestamp,
  toConfidence,
} from "../src/hypergraph";
import {
  extractEntries,
  type HypergraphLoader,
  loadHypergraph,
  persistHypergraph,
  type RelationRecord,
} from "../src/persist";

const resource = "unit";

describe("extractEntries", () => {
  it("returns all entries by default", () => {
    const graph = empty();
    const first = graph.add(fact("Alpha", 0.9, "src"));
    const second = graph.add(relation(first, first, "relates_to"));

    const entries = extractEntries(graph);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.hash)).toContain(String(first));
    expect(entries.map((entry) => entry.hash)).toContain(String(second));
  });

  it("respects onlyDirty filter", () => {
    const graph = empty();
    const baseline = graph.add(fact("Alpha", 0.9, "src"));
    graph.markClean([baseline]);

    graph.add(fact("Beta", 0.5, "src"));

    const entries = extractEntries(graph, { onlyDirty: true });

    expect(entries).toHaveLength(1);
    expect(entries.map((entry) => entry.hash)).not.toContain(String(baseline));
  });
});

describe("persistHypergraph", () => {
  it("calls persist function with dirty entries and marks them clean", async () => {
    const graph = empty();
    const _first = graph.add(fact("Alpha", 0.9, "src"));
    graph.add(fact("Beta", 0.5, "src"));

    const persistFn = vi.fn().mockResolvedValue(undefined);

    await persistHypergraph(graph, resource, persistFn);

    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(persistFn.mock.calls[0][1]).toHaveLength(2);
    expect(graph.getDirty()).toHaveLength(0);

    const third = graph.add(fact("Gamma", 0.7, "src"));
    await persistHypergraph(graph, resource, persistFn);

    const hashes = persistFn.mock.calls[1][1].map(
      (entry: { hash: string }) => entry.hash
    );
    expect(hashes).toContain(String(third));
  });
});

describe("loadHypergraph", () => {
  it("hydrates facts, relations, and derived metadata", async () => {
    const factKnowledge: Knowledge = {
      _: "fact",
      content: "Alpha",
      confidence: toConfidence(0.9),
      source: "unit",
      ts: timestamp(1_700_000_000_000),
    };
    const factHash = knowledgeHash(factKnowledge);
    const otherFact: Knowledge = {
      _: "fact",
      content: "Beta",
      confidence: toConfidence(0.6),
      source: "unit",
      ts: timestamp(1_700_000_000_500),
    };
    const otherHash = knowledgeHash(otherFact);

    const loader: HypergraphLoader = {
      loadNodes: async () => [
        {
          hash: factHash,
          kind: "fact",
          label: factKnowledge.content,
          properties: {
            confidence: Number(factKnowledge.confidence),
            source: factKnowledge.source,
            ts: Number(factKnowledge.ts),
          },
        },
        {
          hash: otherHash,
          kind: "fact",
          label: otherFact.content,
          properties: {
            confidence: Number(otherFact.confidence),
            source: otherFact.source,
            ts: Number(otherFact.ts),
          },
        },
      ],
      loadRelations: async () => [
        relationRecord(factHash, otherHash, "relates_to", 0.4),
      ],
    };

    const graph = empty();
    await loadHypergraph(resource, graph, loader);

    expect(graph.size()).toBeGreaterThanOrEqual(2);
    expect(graph.getDirty()).toHaveLength(0);

    const alpha = graph.get(nodeFromHash(factHash));
    expect(alpha?._).toBe("fact");

    const neighbors = graph.neighbors(nodeFromHash(factHash));
    expect(neighbors).toContain(nodeFromHash(otherHash));
  });
});

function relationRecord(
  fromHash: string,
  toHash: string,
  kind: string,
  weight: number
): RelationRecord {
  return {
    hash: `${fromHash}:${toHash}:${kind}`,
    fromHash,
    toHash,
    kind,
    weight,
  };
}
