const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import "./utils/mock-hypergraph";
import { createTestSession } from "@alfred/test-kit/auth";
import { empty, fact, relation } from "@alfred/knowledge/hypergraph";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { eq } from "drizzle-orm";

let persistHypergraphToDb: typeof import("@alfred/agent/assistant/hypergraph-bridge").persistHypergraphToDb;
let graphRouter: typeof import("@alfred/api/routers/graph").graphRouter;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let _ingest: typeof import("@alfred/rag").ingest;
let setEmbeddingProvider: typeof import("@alfred/rag").setEmbeddingProvider;

const TEST_USER = {
  id: "graph-integration-user",
  email: "graph.integration@test.local",
  name: "Graph Integration",
  roles: ["owner"],
  scopes: ["graph.read", "graph.write", "assistant.write"],
};

function createCaller() {
  const runtime = {
    requestId: `graph-test-${Date.now()}`,
    receivedAt: new Date(),
    method: "POST",
    url: "http://localhost/trpc",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: "bun-test",
    referer: null,
  };

  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["scanContext", null],
  ]);

  const session = createTestSession(TEST_USER, {
    session: { sessionId: `sess-${runtime.requestId}` },
  });

  return graphRouter.createCaller({
    session,
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof graphRouter.createCaller>[0]);
}

async function getNodeIds(resource: string) {
  const rows = await db
    .select({ id: memoryNodes.id })
    .from(memoryNodes)
    .where(eq(memoryNodes.resource, resource));
  return rows.map((row) => row.id);
}

describe("graph router integration (sqlite)", () => {
  beforeAll(async () => {
    ({ persistHypergraphToDb } = await import(
      "@alfred/agent/assistant/hypergraph-bridge"
    ));
    const ragModule = await import("@alfred/rag");
    _ingest = ragModule.ingest;
    setEmbeddingProvider = ragModule.setEmbeddingProvider;
    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const schema = await import("@alfred/db/schema/graph");
    memoryNodes = schema.memoryNodes;
    memoryEdges = schema.memoryEdges;
    ({ graphRouter } = await import("@alfred/api/routers/graph"));
  });

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  afterEach(async () => {
    // Reset RAG embedding provider between tests
    setEmbeddingProvider(null);
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
  });

  it("returns persisted edges via graph.getEdges", async () => {
    const resource = `graph-router-${Date.now()}`;
    const graph = empty();
    const alpha = graph.add(fact("Router Alpha", 0.9, "integration"));
    const beta = graph.add(fact("Router Beta", 0.8, "integration"));
    graph.add(relation(alpha, beta, "relates_to"));

    await persistHypergraphToDb(graph, resource);

    const nodeIds = await getNodeIds(resource);
    expect(nodeIds).toHaveLength(2);

    const caller = createCaller();
    const edges = await caller.getEdges({ nodeIds, resource });

    expect(edges).toHaveLength(1);
    expect(edges[0]?.kind).toBe("relates_to");
    expect(edges[0]?.resource).toBe(resource);
  });

  it("scopes edge queries to the requested resource", async () => {
    const resourceA = `graph-router-a-${Date.now()}`;
    const resourceB = `graph-router-b-${Date.now()}`;
    const graphA = empty();
    const a1 = graphA.add(fact("A1", 0.9, "integration"));
    const a2 = graphA.add(fact("A2", 0.8, "integration"));
    graphA.add(relation(a1, a2, "relates_to"));
    await persistHypergraphToDb(graphA, resourceA);

    const graphB = empty();
    const b1 = graphB.add(fact("B1", 0.7, "integration"));
    const b2 = graphB.add(fact("B2", 0.6, "integration"));
    graphB.add(relation(b1, b2, "relates_to"));
    await persistHypergraphToDb(graphB, resourceB);

    const caller = createCaller();
    const aNodeIds = await getNodeIds(resourceA);
    const bNodeIds = await getNodeIds(resourceB);

    const edgesA = await caller.getEdges({
      nodeIds: aNodeIds,
      resource: resourceA,
    });
    const edgesB = await caller.getEdges({
      nodeIds: bNodeIds,
      resource: resourceB,
    });

    expect(edgesA).toHaveLength(1);
    expect(edgesA[0]?.resource).toBe(resourceA);
    expect(edgesB).toHaveLength(1);
    expect(edgesB[0]?.resource).toBe(resourceB);
  });

  it("creates edges via graph.connect on sqlite fallback", async () => {
    const resource = `graph-connect-${Date.now()}`;
    const graph = empty();
    const _source = graph.add(fact("Connect Source", 0.9, "integration"));
    const _target = graph.add(fact("Connect Target", 0.8, "integration"));
    await persistHypergraphToDb(graph, resource);

    const [fromId, toId] = await getNodeIds(resource);
    const caller = createCaller();

    const inserted = await caller.connect({
      fromId,
      toId,
      kind: "depends_on",
      resource,
    });

    expect(inserted.resource).toBe(resource);
    expect(inserted.kind).toBe("depends_on");

    const edgeCount = await db
      .select({ id: memoryEdges.id })
      .from(memoryEdges)
      .where(eq(memoryEdges.resource, resource));
    expect(edgeCount).toHaveLength(1);

    const edges = await caller.getEdges({ nodeIds: [fromId, toId], resource });
    expect(edges.some((edge) => edge.id === inserted.id)).toBe(true);
  });

  it("traverses explains edges between rag_document and reasoning nodes", async () => {
    const caller = createCaller();

    const source = `graph-prov-${Date.now()}`;
    const _content = "Graph router provenance test document.";

    // Manually create a rag_document node under user resource to act as provenance anchor
    const ragInsert = await db
      .insert(memoryNodes)
      .values({
        kind: "rag_document",
        label: source,
        resource: "user",
        hash: `rag_doc:${source}`,
        properties: {
          documentId: source,
          source,
          ragResource: `rag:${source}`,
        },
      })
      .returning();

    const ragNode = ragInsert[0];
    if (!ragNode) {
      throw new Error("ragNode not found");
    }
    const documentId = source;

    // Create a reasoning node manually under workspace resource
    const resource = `graph-prov-workspace-${Date.now()}`;
    const label = "Reasoning node for graph.runQuery";

    const insertedNodes = await db
      .insert(memoryNodes)
      .values({
        kind: "reasoning",
        label,
        resource,
        hash: `reasoning:${resource}`,
        properties: {
          ragDocumentIds: [documentId],
        },
      })
      .returning();

    const reasoningNode = insertedNodes[0];
    if (!reasoningNode) {
      throw new Error("reasoningNode not found");
    }

    // Create explains edge from rag_document -> reasoning node under user resource
    const [explains] = await db
      .insert(memoryEdges)
      .values({
        fromId: ragNode?.id,
        toId: reasoningNode.id,
        kind: "explains",
        resource: "user",
        hash: `explains:${ragNode?.id}:${reasoningNode.id}`,
        weight: 1,
        metadata: {
          documentId,
        },
      })
      .onConflictDoNothing({ target: memoryEdges.hash })
      .returning();

    expect(explains).toBeTruthy();

    // Traverse incoming edges to the reasoning node via graph.runQuery
    const result = await caller.runQuery({
      kind: "traverse",
      nodeId: reasoningNode.id,
      direction: "in",
      resource: "user",
    });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    const edges = result.edges ?? [];
    expect(edges.length).toBeGreaterThanOrEqual(1);

    const seenRag = result.nodes.some((node: any) => {
      const isRagDoc = node.kind === "rag_document";
      const props = (node.properties ?? null) as Record<string, unknown> | null;
      return isRagDoc && props?.documentId === documentId;
    });
    expect(seenRag).toBe(true);

    const seenExplains = edges.some((edge: any) => edge.kind === "explains");
    expect(seenExplains).toBe(true);
  });
});
