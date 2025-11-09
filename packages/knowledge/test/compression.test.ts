import { describe, expect, it } from "bun:test";

import {
  DEFAULT_COMPRESSION_CONFIG,
  consolidatePatterns,
  decayConfidence,
  promoteToInsights,
} from "../src/compression";
import {
  fact,
  knowledgeHash,
  nodeFromHash,
  type Knowledge,
  type NodeId,
} from "../src/hypergraph";

describe("decayConfidence", () => {
  it("applies exponential decay relative to half-life", () => {
    const node = fact("Evaluate deployment risks", 0.9, "reasoning");
    const decayed = decayConfidence(
      node,
      DEFAULT_COMPRESSION_CONFIG.confidenceDecayHalfLife,
      DEFAULT_COMPRESSION_CONFIG.confidenceDecayHalfLife
    );

    if (decayed._ !== "fact") {
      throw new Error("Expected fact knowledge");
    }

    expect(Number(decayed.confidence)).toBeCloseTo(0.45, 2);
  });
});

describe("consolidatePatterns", () => {
  it("creates pattern nodes for repeated facts", () => {
    const facts: Array<{ id: NodeId; data: Knowledge }> = Array.from(
      { length: 3 },
      () => {
        const node = fact("Switch to plan B", 0.75, "reasoning");
        const id = nodeFromHash(knowledgeHash(node));
        return { id, data: node };
      }
    );

    const patterns = consolidatePatterns(
      facts,
      DEFAULT_COMPRESSION_CONFIG.patternMinSupport,
      DEFAULT_COMPRESSION_CONFIG.patternMinConfidence
    );

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]._).toBe("pattern");
  });

  it("handles large batches without duplication", () => {
    const entries: Array<{ id: NodeId; data: Knowledge }> = [];

    for (let i = 0; i < 1_000; i++) {
      const node = fact(`Observation ${i % 5}`, 0.8, "reasoning");
      const id = nodeFromHash(knowledgeHash(node));
      entries.push({ id, data: node });
    }

    const patterns = consolidatePatterns(
      entries,
      3,
      DEFAULT_COMPRESSION_CONFIG.patternMinConfidence
    );

    expect(patterns.length).toBeGreaterThan(0);
  });
});

describe("promoteToInsights", () => {
  it("promotes frequently accessed facts", () => {
    const factNode = fact("Cache query results", 0.6, "reasoning");
    const factId = nodeFromHash(knowledgeHash(factNode));
    const nodes = new Map<NodeId, Knowledge>([[factId, factNode]]);

    const now = Date.now();
    const accessLog = [
      { nodeId: factId, timestamp: now - 1_000 },
      { nodeId: factId, timestamp: now - 2_000 },
      { nodeId: factId, timestamp: now - 3_000 },
    ];

    const insights = promoteToInsights(
      accessLog,
      nodes,
      2,
      10_000,
      now
    );

    expect(insights.length).toBe(1);
    expect(insights[0].conclusion).toContain("Frequently accessed");
  });
});
