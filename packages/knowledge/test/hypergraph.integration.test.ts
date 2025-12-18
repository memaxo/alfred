import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import type * as HypergraphBridge from "@alfred/agent/assistant/hypergraph-bridge";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { and, count, eq } from "drizzle-orm";
import {
  empty,
  fact,
  type Knowledge,
  relation,
  timestamp,
  toConfidence,
} from "../src/hypergraph";
import { semanticQuery } from "../src/query";

// This integration test requires RUN_DB_TESTS=1 and a proper Postgres database
const SHOULD_RUN = Boolean(process.env.RUN_DB_TESTS);

let persistHypergraphToDb: HypergraphBridge["persistHypergraphToDb"];
let loadHypergraphFromDb: HypergraphBridge["loadHypergraphFromDb"];
let graphRepo: typeof import("@alfred/db/repo/graph");
let db: typeof import("@alfred/db")["db"]; // NodePgDatabase
let dbInitialized = false;

const timedFact = (content: string, tsValue: number): Knowledge => ({
  _: "fact",
  content,
  confidence: toConfidence(0.85),
  source: "integration",
  ts: timestamp(tsValue),
});

beforeAll(async () => {
  if (!SHOULD_RUN) {
    return;
  }
  
  // Import db module
  const dbModule = await import("@alfred/db");
  db = dbModule.db;
  
  // Verify db has required methods (Postgres only)
  if (typeof db.delete !== "function") {
    console.warn("Skipping hypergraph integration tests: db.delete not available");
    return;
  }

  const bridge = await import("@alfred/agent/assistant/hypergraph-bridge");
  persistHypergraphToDb = bridge.persistHypergraphToDb;
  loadHypergraphFromDb = bridge.loadHypergraphFromDb;

  graphRepo = await import("@alfred/db/repo/graph");
  dbInitialized = true;
});

afterEach(async () => {
  if (!dbInitialized || !db || typeof db.delete !== "function") {
    return;
  }
  try {
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
  } catch {
    // Ignore cleanup errors
  }
});

const describeFn = SHOULD_RUN ? describe : describe.skip;

describeFn("hypergraph persistence integration", () => {
  it("persists and reloads knowledge entries", async () => {
    const resource = `integration-${Date.now()}`;
    const graph = empty();
    const alpha = graph.add(fact("Alpha project timeline", 0.9, "integration"));
    const beta = graph.add(fact("Beta risk analysis", 0.8, "integration"));
    graph.add(relation(alpha, beta, "relates_to"));

    await persistHypergraphToDb(graph, resource);

    const rehydrated = empty();
    await loadHypergraphFromDb(resource, rehydrated);

    expect(rehydrated.size()).toBe(graph.size());
    expect(rehydrated.get(alpha)?.content).toContain("Alpha project");
    expect(rehydrated.neighbors(alpha)).toContain(beta);

    const semanticHits = semanticQuery("alpha project", rehydrated, 5);
    expect(semanticHits).toContain(alpha);
  });

  it("exposes neighbors via repo scoped queries", async () => {
    const resource = `neighbors-${Date.now()}`;
    const graph = empty();
    const source = graph.add(fact("Source", 0.95, "integration"));
    const target = graph.add(fact("Target", 0.9, "integration"));
    graph.add(relation(source, target, "relates_to"));

    await persistHypergraphToDb(graph, resource);

    const sourceRow = await db
      .select({ id: memoryNodes.id })
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.resource, resource),
          eq(memoryNodes.hash, String(source))
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!sourceRow) {
      throw new Error("Failed to load persisted source node");
    }

    const neighbors = await graphRepo.getNeighbors(sourceRow.id, {
      resource,
      direction: "out",
    });

    expect(neighbors.length).toBe(1);
    expect(neighbors[0]?.otherNodeId).toBeTruthy();

    // Persist another resource to ensure filtering works
    const otherGraph = empty();
    const other = otherGraph.add(fact("Other", 0.5, "integration"));
    otherGraph.add(relation(other, other, "relates_to"));
    await persistHypergraphToDb(otherGraph, `${resource}-other`);

    const filtered = await graphRepo.getNeighbors(sourceRow.id, {
      resource,
      direction: "out",
    });
    expect(filtered).toHaveLength(1);
  });

  it("loads only requested resource data", async () => {
    const resourceA = `resource-a-${Date.now()}`;
    const resourceB = `resource-b-${Date.now()}`;
    const graphA = empty();
    graphA.add(fact("Resource A Alpha", 0.9, "integration"));
    graphA.add(fact("Resource A Beta", 0.8, "integration"));

    const graphB = empty();
    graphB.add(fact("Resource B Alpha", 0.7, "integration"));

    await persistHypergraphToDb(graphA, resourceA);
    await persistHypergraphToDb(graphB, resourceB);

    const resourceANodes = await countNodes(resourceA);
    const resourceBNodes = await countNodes(resourceB);
    expect(resourceANodes).toBe(graphA.size());
    expect(resourceBNodes).toBe(graphB.size());

    const rehydrated = empty();
    await loadHypergraphFromDb(resourceA, rehydrated);

    expect(rehydrated.size()).toBe(graphA.size());
    expect(rehydrated.search("Resource B")).toHaveLength(0);
  });

  it("preserves interval queries after reload", async () => {
    const resource = `timeline-${Date.now()}`;
    const graph = empty();
    const early = graph.add(timedFact("Early milestone", 1000));
    const mid = graph.add(timedFact("Mid milestone", 2000));
    graph.add(timedFact("Late milestone", 5000));

    await persistHypergraphToDb(graph, resource);

    const rehydrated = empty();
    await loadHypergraphFromDb(resource, rehydrated);

    const windowHits = rehydrated.between(timestamp(0), timestamp(2500));
    expect(windowHits).toEqual(expect.arrayContaining([early, mid]));

    const lateWindow = rehydrated.between(timestamp(4000), timestamp(6000));
    expect(lateWindow.length).toBe(1);
  });

  it("skips persistence when no nodes are dirty", async () => {
    const resource = `noop-${Date.now()}`;
    const graph = empty();
    graph.add(fact("Initial", 0.9, "integration"));

    await persistHypergraphToDb(graph, resource);
    const before = await countNodes(resource);

    await persistHypergraphToDb(graph, resource);
    const after = await countNodes(resource);

    expect(before).toBe(after);
  });
});

async function countNodes(resource: string): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(memoryNodes)
    .where(eq(memoryNodes.resource, resource));
  return rows[0]?.total ?? 0;
}
