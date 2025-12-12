import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_RESOURCE = "test-resource";

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;

async function resetGraph() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

describeFn("graphRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "graphRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    graphRepo = mod.graphRepo;
    db = mod.db;
  });

  beforeEach(async () => {
    await resetGraph();
  });

  it("upserts nodes by resource and hash", async () => {
    const first = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "fact-hash",
        kind: "fact",
        label: "First Fact",
        properties: { confidence: 0.8 },
      },
      {
        resource: TEST_RESOURCE,
        hash: "insight-hash",
        kind: "insight",
        label: "Insight",
        properties: { derived: [] },
      },
    ]);

    expect(first.size).toBe(2);

    const second = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "fact-hash",
        kind: "fact",
        label: "Updated Fact",
        properties: { confidence: 0.9 },
      },
    ]);

    const updated = second.get(`${TEST_RESOURCE}:fact-hash`);
    expect(updated?.label).toBe("Updated Fact");
    expect(updated?.properties).toEqual({ confidence: 0.9 });
  });

  it("creates edges and retrieves neighbors", async () => {
    const nodes = await graphRepo.upsertNodes([
      { resource: TEST_RESOURCE, hash: "n1", kind: "fact", label: "N1" },
      { resource: TEST_RESOURCE, hash: "n2", kind: "insight", label: "N2" },
    ]);
    const nodeIds = Array.from(nodes.values()).map((node) => node.id);

    const id1 = nodeIds[0];
    const id2 = nodeIds[1];

    if (!(id1 && id2)) {
      throw new Error("Missing node ids");
    }

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "edge-hash",
        fromId: id1,
        toId: id2,
        kind: "supports",
        weight: 0.8,
      },
    ]);

    const neighbors = await graphRepo.getNeighbors(id1, {
      direction: "out",
      resource: TEST_RESOURCE,
    });
    expect(neighbors.length).toBe(1);
    expect(neighbors[0]?.edge.kind).toBe("supports");
    expect(neighbors[0]?.otherNodeId).toBe(id2);
  });

  it("finds path between nodes", async () => {
    // Create A -> B -> C
    const nodes = await graphRepo.upsertNodes([
      { resource: TEST_RESOURCE, hash: "A", kind: "node", label: "A" },
      { resource: TEST_RESOURCE, hash: "B", kind: "node", label: "B" },
      { resource: TEST_RESOURCE, hash: "C", kind: "node", label: "C" },
    ]);

    const map = new Map<string, string>(); // hash -> id
    for (const node of nodes.values()) {
      map.set(node.hash, node.id);
    }

    const idA = map.get("A")!;
    const idB = map.get("B")!;
    const idC = map.get("C")!;

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "ab",
        fromId: idA,
        toId: idB,
        kind: "link",
      },
      {
        resource: TEST_RESOURCE,
        hash: "bc",
        fromId: idB,
        toId: idC,
        kind: "link",
      },
    ]);

    const path = await graphRepo.findPath(idA, idC, 5, TEST_RESOURCE);

    // path is array of { nodeId, via }
    expect(path.length).toBe(3);
    expect(path[0]?.nodeId).toBe(idA);
    expect(path[1]?.nodeId).toBe(idB);
    expect(path[2]?.nodeId).toBe(idC);
  });

  it("retrieves subgraph", async () => {
    // Create A -> B, C -> B
    const nodes = await graphRepo.upsertNodes([
      { resource: TEST_RESOURCE, hash: "sub-A", kind: "node", label: "A" },
      { resource: TEST_RESOURCE, hash: "sub-B", kind: "node", label: "B" },
      { resource: TEST_RESOURCE, hash: "sub-C", kind: "node", label: "C" },
      { resource: TEST_RESOURCE, hash: "sub-D", kind: "node", label: "D" }, // Unconnected
    ]);

    const map = new Map<string, string>();
    for (const node of nodes.values()) {
      map.set(node.hash, node.id);
    }

    const idA = map.get("sub-A")!;
    const idB = map.get("sub-B")!;
    const idC = map.get("sub-C")!;

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "ab",
        fromId: idA,
        toId: idB,
        kind: "link",
      },
      {
        resource: TEST_RESOURCE,
        hash: "cb",
        fromId: idC,
        toId: idB,
        kind: "link",
      },
    ]);

    // Get subgraph for A and C
    const { nodes: subNodes, edges: subEdges } = await graphRepo.getSubgraph(
      [idA, idC],
      TEST_RESOURCE
    );

    // Should include A and C (explicitly asked)
    expect(subNodes.some((n) => n.id === idA)).toBe(true);
    expect(subNodes.some((n) => n.id === idC)).toBe(true);
    // Shouldn't implicitly include B just because it's connected, unless we ask for it or the logic does expanding
    // Logic for getSubgraph: "where id in ids" AND "edges where from in ids OR to in ids"
    // So it gets edges connected to input nodes, but only returns nodes that are in input list.
    // Wait, let me check getSubgraph implementation in read.ts/traverse.ts.
    // It returns nodes matching input IDs.
    // It returns edges connected to input IDs.

    expect(subNodes.length).toBe(2);
    expect(subEdges.length).toBe(2); // A->B and C->B both touch the set {A, C}
  });

  it("bulk-updates node confidence without clobbering properties", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "conf-1",
        kind: "fact",
        label: "Conf 1",
        properties: { confidence: 0.8, domain: "a" },
      },
      {
        resource: TEST_RESOURCE,
        hash: "conf-2",
        kind: "fact",
        label: "Conf 2",
        properties: null,
      },
      {
        resource: TEST_RESOURCE,
        hash: "conf-3",
        kind: "fact",
        label: "Conf 3",
        properties: { confidence: 0.2 },
      },
    ]);

    const id1 = nodes.get(`${TEST_RESOURCE}:conf-1`)?.id;
    const id2 = nodes.get(`${TEST_RESOURCE}:conf-2`)?.id;
    const id3 = nodes.get(`${TEST_RESOURCE}:conf-3`)?.id;

    if (!(id1 && id2 && id3)) {
      throw new Error("Missing node ids");
    }

    const updated = await graphRepo.updateNodeConfidenceBatch([
      { id: id1, confidence: 0.5 },
      { id: id2, confidence: 0.3 },
      { id: id3, confidence: 2 }, // clamped
      { id: "00000000-0000-0000-0000-000000000000", confidence: 0.1 }, // missing
    ]);

    expect(updated).toBe(3);

    const n1 = await graphRepo.getNode(id1);
    const n2 = await graphRepo.getNode(id2);
    const n3 = await graphRepo.getNode(id3);

    expect(n1?.properties).toEqual({ confidence: 0.5, domain: "a" });
    expect(n2?.properties).toEqual({ confidence: 0.3 });
    expect(n3?.properties).toEqual({ confidence: 1 });
  });

  it("reconstructs reasoning chain", async () => {
    const executionId = "exec-1";
    // Steps 1 -> 2 -> 3
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "step-1",
        kind: "reasoning",
        label: "Step 1",
        properties: { executionId, sequenceIndex: 1, timestamp: 100 },
      },
      {
        resource: TEST_RESOURCE,
        hash: "step-2",
        kind: "reasoning",
        label: "Step 2",
        properties: { executionId, sequenceIndex: 2, timestamp: 200 },
      },
      {
        resource: TEST_RESOURCE,
        hash: "step-3",
        kind: "reasoning",
        label: "Step 3",
        properties: { executionId, sequenceIndex: 3, timestamp: 300 },
      },
    ]);

    const map = new Map<string, string>();
    for (const node of nodes.values()) {
      map.set(node.hash, node.id);
    }
    const s1 = map.get("step-1")!;
    const s2 = map.get("step-2")!;
    const s3 = map.get("step-3")!;

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "1-2",
        fromId: s1,
        toId: s2,
        kind: "precedes",
        metadata: { fromIndex: 1 },
      },
      {
        resource: TEST_RESOURCE,
        hash: "2-3",
        fromId: s2,
        toId: s3,
        kind: "precedes",
        metadata: { fromIndex: 2 },
      },
    ]);

    const chain = await graphRepo.getReasoningChain({
      resource: TEST_RESOURCE,
      executionId,
    });

    expect(chain.nodes.length).toBe(3);
    expect(chain.nodes[0]?.label).toBe("Step 1");
    expect(chain.nodes[1]?.label).toBe("Step 2");
    expect(chain.nodes[2]?.label).toBe("Step 3");
    expect(chain.edges.length).toBe(2);
  });

  it("finds nearest concept", async () => {
    // Concept hierarchy: Programming -> Languages -> TypeScript
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "prog",
        kind: "concept",
        label: "Programming",
      },
      {
        resource: TEST_RESOURCE,
        hash: "lang",
        kind: "concept",
        label: "Languages",
      },
      {
        resource: TEST_RESOURCE,
        hash: "ts",
        kind: "concept",
        label: "TypeScript",
      },
      {
        resource: TEST_RESOURCE,
        hash: "cooking",
        kind: "concept",
        label: "Cooking",
      },
    ]);

    const map = new Map<string, string>();
    for (const node of nodes.values()) {
      map.set(node.label, node.id);
    }

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "p-l",
        fromId: map.get("Programming")!,
        toId: map.get("Languages")!,
        kind: "related",
      },
      {
        resource: TEST_RESOURCE,
        hash: "l-t",
        fromId: map.get("Languages")!,
        toId: map.get("TypeScript")!,
        kind: "related",
      },
    ]);

    // Search for "TypeScript" starting from "Programming"
    const result = await graphRepo.findNearestConcept(
      "Programming",
      ["TypeScript", "Cooking"],
      5,
      TEST_RESOURCE
    );

    expect(result).not.toBeNull();
    expect(result?.concept).toBe("TypeScript");
    // Path includes the starting node id(s); depth is edges traversed.
    expect(result?.path.length).toBe(3);
  });
});
