import { describe, it, expect } from "bun:test";
import { describeSqlite } from "@alfred/db/testing";
import { graphRepo } from "@alfred/db";
import { runQuery } from "../src/query";

type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
};

type EdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
  metadata?: unknown;
};

describeSqlite("graph.runQuery traverse with sqlite driver", () => {
  it("returns neighbor node for a simple sqlite-backed graph", async () => {
    const resource = `test:graph-sqlite:${Date.now()}`;

    const nodes: NodeSeed[] = [
      {
        resource,
        hash: "node-a",
        kind: "fact",
        label: "Runtime A",
      },
      {
        resource,
        hash: "node-b",
        kind: "fact",
        label: "Runtime B",
      },
    ];

    const nodeMap = await graphRepo.upsertNodes(nodes as any);
    const a = nodeMap.get(`${resource}:node-a`);
    const b = nodeMap.get(`${resource}:node-b`);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();

    const edges: EdgeSeed[] = [
      {
        resource,
        hash: "edge-a-b",
        fromId: a!.id,
        toId: b!.id,
        kind: "relates_to",
        weight: 1,
      },
    ];

    await graphRepo.upsertEdges(edges as any);

    const result = await runQuery(
      {
        kind: "traverse",
        nodeId: a!.id,
        direction: "out",
        resource,
        limit: 10,
      },
      { resource }
    );

    expect(result.nodes.length).toBe(2);
    const labels = result.nodes.map((node) => node.label).sort();
    expect(labels).toEqual(["Runtime A", "Runtime B"]);
    expect(result.edges?.length ?? 0).toBe(1);
  });
});

