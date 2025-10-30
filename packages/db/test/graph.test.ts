import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const TEST_RESOURCE = "test-resource";

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;

beforeAll(async () => {
  const mod = await import("@alfred/db");
  graphRepo = mod.graphRepo;
  db = mod.db;
});

async function resetGraph() {
  await db.execute(sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  await resetGraph();
});

describe("graphRepo", () => {
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

    const nodeCount = await db.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM memory_nodes`,
    );
    expect(nodeCount.rows?.[0]?.total).toBe(2);
  });

  it("upserts edges referencing stored nodes", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "node-a",
        kind: "fact",
        label: "Node A",
        properties: null,
      },
      {
        resource: TEST_RESOURCE,
        hash: "node-b",
        kind: "fact",
        label: "Node B",
        properties: null,
      },
    ]);

    const nodeA = nodes.get(`${TEST_RESOURCE}:node-a`);
    const nodeB = nodes.get(`${TEST_RESOURCE}:node-b`);

    expect(nodeA?.id).toBeDefined();
    expect(nodeB?.id).toBeDefined();

    const edges = await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "edge-hash",
        fromId: nodeA!.id,
        toId: nodeB!.id,
        kind: "causes",
        weight: 0.9,
        metadata: { from: "node-a", to: "node-b" },
      },
    ]);

    expect(edges.length).toBe(1);

    const updated = await graphRepo.upsertEdges([
      {
        resource: TEST_RESOURCE,
        hash: "edge-hash",
        fromId: nodeA!.id,
        toId: nodeB!.id,
        kind: "causes",
        weight: 0.7,
        metadata: { from: "node-a", to: "node-b" },
      },
    ]);

    expect(updated[0]?.weight).toBeCloseTo(0.7);

    const edgeCount = await db.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM memory_edges`,
    );
    expect(edgeCount.rows?.[0]?.total).toBe(1);
  });
});
