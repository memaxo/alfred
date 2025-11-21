import { beforeAll, beforeEach, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import {
  describePostgres,
  requirePostgresTestEnv,
} from "@alfred/db/testing";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_RESOURCE = "test-resource";

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;

async function resetGraph() {
  if (!db) return;
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

    await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        fromNodeId: nodeIds[0]!,
        toNodeId: nodeIds[1]!,
        relation: "supports",
        weight: 0.8,
      },
    ]);

    const neighbors = await graphRepo.getNeighbors(nodeIds[0]!, {
      direction: "out",
      resource: TEST_RESOURCE,
    });
    expect(neighbors.length).toBe(1);
    expect(neighbors[0]?.edge.kind).toBe("supports");
    expect(neighbors[0]?.otherNodeId).toBe(nodeIds[1]);
  });
});
