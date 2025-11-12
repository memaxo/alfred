import { describe, expect, it } from "bun:test";

import { reconstructReasoningChain } from "../src/query";

describe("reconstructReasoningChain", () => {
  it("orders reasoning nodes by sequence index and populates links", () => {
    const nodes = [
      {
        id: "node-2",
        hash: "hash-2",
        label: "Evaluate alternative plan",
        properties: {
          sequenceIndex: 1,
          previousHash: "hash-1",
          nextHash: "hash-3",
          timestamp: 2000,
        },
      },
      {
        id: "node-1",
        hash: "hash-1",
        label: "Considering initial approach",
        properties: {
          sequenceIndex: 0,
          nextHash: "hash-2",
          timestamp: 1000,
        },
      },
      {
        id: "node-3",
        hash: "hash-3",
        label: "Selecting option beta",
        properties: {
          sequenceIndex: 2,
          previousHash: "hash-2",
          timestamp: 3000,
        },
      },
    ];

    const edges = [
      {
        fromId: "node-1",
        toId: "node-2",
        kind: "precedes",
        metadata: { timeDelta: 1000 },
      },
      {
        fromId: "node-2",
        toId: "node-3",
        kind: "precedes",
        metadata: { timeDelta: 1000 },
      },
    ];

    const chain = reconstructReasoningChain(nodes, edges);

    expect(chain.map((step) => step.hash)).toEqual([
      "hash-1",
      "hash-2",
      "hash-3",
    ]);
    expect(chain[0]?.nextHash).toBe("hash-2");
    expect(chain[1]?.previousHash).toBe("hash-1");
    expect(chain[1]?.relations[0]?.toId).toBe("node-3");
    expect(chain[1]?.relations[0]?.timeDelta).toBe(1000);
  });
});
