import { describe, expect, it } from "bun:test";
import { BUDGET_DEFAULTS, benchmarkOperation } from "@alfred/test-kit";
import { empty, fact, relation } from "../src/hypergraph";

// budget: graph-lookup

describe("hypergraph traversal performance budget", () => {
  it("neighborsByKind stays within graph-lookup budget", async () => {
    const graph = empty();

    const source = graph.add(fact("Source node", 0.99, "perf"));
    const kind = "relates_to";

    // Build a moderate fan-out to exercise traversal without making the test slow.
    for (let i = 0; i < 500; i += 1) {
      const target = graph.add(fact(`Target ${i}`, 0.8, "perf"));
      graph.add(relation(source, target, kind));
    }

    const stats = await benchmarkOperation(
      "graph-lookup.neighborsByKind",
      BUDGET_DEFAULTS["graph-lookup"],
      2000,
      async () => {
        graph.neighborsByKind(source, kind);
      }
    );

    expect(stats.p99).toBeLessThan(BUDGET_DEFAULTS["graph-lookup"]);
  });
});
