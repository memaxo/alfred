const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { createTestSession } from "@alfred/test-kit/auth";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { and, eq, inArray } from "drizzle-orm";

let graphRouter: typeof import("@alfred/api/routers/graph").graphRouter;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;

const TEST_USER = {
  id: "graph-mirror-user",
  email: "graph.mirror@test.local",
  name: "Graph Mirror",
  roles: ["owner"],
  scopes: ["graph.read", "graph.write"],
};

function createCaller() {
  const runtime = {
    requestId: `graph-mirror-test-${Date.now()}`,
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

describe("graph mirror integration (sqlite)", () => {
  beforeAll(async () => {
    ({ graphRouter } = await import("@alfred/api/routers/graph"));
    ({ db } = await import("@alfred/db"));
    ({ memoryNodes } = await import("@alfred/db/schema/graph"));
  });

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  afterEach(async () => {
    await db.delete(memoryNodes).execute();
  });

  it("creates mirror nodes for note/reminder/workflow_run and returns UUID dbIds", async () => {
    const noteId = crypto.randomUUID();
    const reminderId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    const caller = createCaller();
    const result = await caller.ensureMirrors({
      resource: "user",
      entities: [
        { kind: "note", id: noteId },
        { kind: "reminder", id: reminderId },
        { kind: "workflow_run", id: runId },
      ],
    });

    expect(result.refs).toHaveLength(3);
    for (const ref of result.refs) {
      expect(ref.ref.resource).toBe("user");
      // In Postgres this is a UUID, but in sqlite tests Drizzle's uuid().defaultRandom()
      // produces lower(hex(randomblob(16))) which is a 32-char hex string.
      expect(ref.ref.id.dbId).toMatch(
        /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})$/i
      );
    }

    const expectedHashes = [
      `note:${noteId}`,
      `reminder:${reminderId}`,
      `workflowrun:${runId}`,
    ];

    const rows = await db
      .select({ id: memoryNodes.id, hash: memoryNodes.hash })
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.resource, "user"),
          inArray(memoryNodes.hash, expectedHashes)
        )
      );

    expect(rows).toHaveLength(3);
  });
});
