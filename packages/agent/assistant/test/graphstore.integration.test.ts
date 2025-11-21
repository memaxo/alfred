const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { empty, fact, relation } from "@alfred/knowledge/hypergraph";
import { extractEntries } from "@alfred/knowledge/persist";
import { eq } from "drizzle-orm";

let persistKnowledge: typeof import("../src/graphstore").persistKnowledge;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;

describe("graphstore integration (sqlite)", () => {
  beforeAll(async () => {
    ({ persistKnowledge } = await import("../src/graphstore"));
    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const schema = await import("@alfred/db/schema/graph");
    memoryNodes = schema.memoryNodes;
    memoryEdges = schema.memoryEdges;
  });

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  afterEach(async () => {
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
  });

  it("persists nodes and relations via persistKnowledge", async () => {
    const resource = `graphstore-${Date.now()}`;
    const graph = buildGraph();
    const entries = extractEntries(graph);
    const factCount = entries.filter((entry) => entry.data._ !== "relation").length;
    const relationCount = entries.length - factCount;

    await persistKnowledge(resource, entries);

    const nodes = await db
      .select({ id: memoryNodes.id })
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));
    const edges = await db
      .select({ id: memoryEdges.id })
      .from(memoryEdges)
      .where(eq(memoryEdges.resource, resource));

    expect(nodes).toHaveLength(factCount);
    expect(edges).toHaveLength(relationCount);
  });

  it("no-ops when persisting identical entries twice", async () => {
    const resource = `graphstore-idempotent-${Date.now()}`;
    const graph = buildGraph();
    const entries = extractEntries(graph);

    await persistKnowledge(resource, entries);
    const firstCounts = await countGraphRows(resource);

    await persistKnowledge(resource, entries);
    const secondCounts = await countGraphRows(resource);

    expect(secondCounts).toEqual(firstCounts);
  });
});

function buildGraph() {
  const graph = empty();
  const alpha = graph.add(fact("Graphstore Alpha", 0.9, "integration"));
  const beta = graph.add(fact("Graphstore Beta", 0.85, "integration"));
  graph.add(relation(alpha, beta, "relates_to"));
  return graph;
}

async function countGraphRows(resource: string) {
  const [nodes, edges] = await Promise.all([
    db
      .select({ id: memoryNodes.id })
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource)),
    db
      .select({ id: memoryEdges.id })
      .from(memoryEdges)
      .where(eq(memoryEdges.resource, resource)),
  ]);
  return { nodes: nodes.length, edges: edges.length };
}
