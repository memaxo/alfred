const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";

import { empty, fact, relation } from "@alfred/knowledge/hypergraph";
import { extractEntries } from "@alfred/knowledge/persist";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
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
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  afterEach(async () => {
    await runMutation(db.delete(memoryEdges));
    await runMutation(db.delete(memoryNodes));
  });

  it("persists nodes and relations via persistKnowledge", async () => {
    const resource = `graphstore-${Date.now()}`;
    const graph = buildGraph();
    const entries = extractEntries(graph);
    const factCount = entries.filter(
      (entry) => entry.data._ !== "relation"
    ).length;
    const relationCount = entries.length - factCount;

    await persistKnowledge(resource, entries);

    const nodes = await fetchRows(
      db
        .select({ id: memoryNodes.id })
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, resource))
    );
    const edges = await fetchRows(
      db
        .select({ id: memoryEdges.id })
        .from(memoryEdges)
        .where(eq(memoryEdges.resource, resource))
    );

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
    fetchRows(
      db
        .select({ id: memoryNodes.id })
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, resource))
    ),
    fetchRows(
      db
        .select({ id: memoryEdges.id })
        .from(memoryEdges)
        .where(eq(memoryEdges.resource, resource))
    ),
  ]);
  return { nodes: nodes.length, edges: edges.length };
}

function fetchRows<T>(query: Promise<T> | { all?: () => T }): Promise<T> {
  if (typeof (query as Promise<T>).then === "function") {
    return query as Promise<T>;
  }
  if (typeof (query as { all?: () => T }).all === "function") {
    return Promise.resolve((query as { all: () => T }).all());
  }
  return Promise.reject(
    new Error("Unsupported driver: select builder missing .then/.all")
  );
}

async function runMutation(query: Promise<unknown> | { run?: () => unknown }) {
  if (typeof (query as Promise<unknown>).then === "function") {
    await query;
    return;
  }
  if (typeof (query as { run?: () => unknown }).run === "function") {
    await (query as { run: () => unknown }).run();
    return;
  }
  throw new Error("Unsupported driver: mutation builder missing .then/.run");
}
