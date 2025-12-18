const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import "./utils/mock-hypergraph";
import { createTestSession } from "@alfred/test-kit/auth";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { eq } from "drizzle-orm";

let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let knowledgeRouter: typeof import("@alfred/api/routers/knowledge").knowledgeRouter;

const TEST_USER = {
  id: "knowledge-visualize-user",
  email: "knowledge.visualize@test.local",
  name: "Knowledge Visualize",
  roles: ["owner"],
  scopes: ["assistant.write"],
};

function createCaller() {
  const runtime = {
    requestId: `knowledge-test-${Date.now()}`,
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

  return knowledgeRouter.createCaller({
    session,
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof knowledgeRouter.createCaller>[0]);
}

describe("knowledge.visualize (sqlite)", () => {
  beforeAll(async () => {
    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const schema = await import("@alfred/db/schema/graph");
    memoryNodes = schema.memoryNodes;
    memoryEdges = schema.memoryEdges;
    ({ knowledgeRouter } = await import("@alfred/api/routers/knowledge"));
  });

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  afterEach(async () => {
    // Note: schema types are Pg-flavoured; `.execute()` works across drivers.
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
  });

  it("extracts and persists entity facts, returning concept nodes + edges", async () => {
    const caller = createCaller();
    const resource = `knowledge-visualize-${Date.now()}`;

    const result = await caller.visualize({
      resource,
      text: "Elon Musk founded SpaceX in 2002.",
      limit: 10,
    });

    expect(result.meta.extractedEntities).toBeGreaterThan(0);

    const storedAll = await db
      .select({
        id: memoryNodes.id,
        label: memoryNodes.label,
        kind: memoryNodes.kind,
      })
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));

    expect(storedAll.length).toBeGreaterThan(0);
    expect(
      storedAll.some((row) =>
        /^[[(]entity:/.test(row.label.trim().toLowerCase())
      )
    ).toBe(true);

    expect(result.nodes.length).toBeGreaterThanOrEqual(2);
    expect(
      result.nodes.some((n) => n.label.toLowerCase().includes("elon"))
    ).toBe(true);
    expect(
      result.nodes.some((n) => n.label.toLowerCase().includes("spacex"))
    ).toBe(true);

    // Relation extraction should create at least one edge between entity nodes
    expect(result.edges.length).toBeGreaterThanOrEqual(1);

    const stored = await db
      .select({ id: memoryNodes.id, label: memoryNodes.label })
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));

    expect(stored.length).toBeGreaterThan(0);
    expect(
      stored.some((row) => /^[[(]entity:/.test(row.label.trim().toLowerCase()))
    ).toBe(true);
  });

  it("handles text with minimal entities gracefully", async () => {
    const caller = createCaller();
    const resource = `test-minimal-${Date.now()}`;

    const result = await caller.visualize({
      resource,
      text: "Hello world.",
      limit: 10,
    });

    // Should complete without error
    // Note: Even simple text may have facts extracted, but minimal entity nodes
    expect(result.meta).toBeDefined();
    expect(result.nodes.length).toBeGreaterThanOrEqual(0);
    expect(result.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("handles duplicate entities in input text", async () => {
    const caller = createCaller();
    const resource = `test-duplicates-${Date.now()}`;

    const result = await caller.visualize({
      resource,
      text: "Elon Musk met Elon Musk. SpaceX launched SpaceX rockets.",
      limit: 10,
    });

    // Should extract unique entities
    expect(result.meta.extractedEntities).toBeGreaterThan(0);

    // Check that duplicate entity names don't create duplicate nodes
    const elonNodes = result.nodes.filter((n) =>
      n.label.toLowerCase().includes("elon")
    );
    // Should have at most 1 node for "Elon Musk" (deduplication via hash)
    expect(elonNodes.length).toBeLessThanOrEqual(1);

    const spacexNodes = result.nodes.filter((n) =>
      n.label.toLowerCase().includes("spacex")
    );
    expect(spacexNodes.length).toBeLessThanOrEqual(1);
  });
});
