import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describe : describe.skip;

if (SHOULD_RUN) {
  // Force sqlite so this test never depends on Postgres.
  process.env.DATABASE_URL = "sqlite::memory:";
  process.env.OPENAI_API_KEY ??= "test";
  process.env.DISABLE_METRICS_HOOKS = "1";
  process.env.DISABLE_TRPC_METRICS = "1";
}

type AppRouter = typeof import("@alfred/api/routers/index").appRouter;

describeFn("agentfs audit integration (db)", () => {
  const repoCwd = process.cwd();
  const rootAbs = path.resolve(
    repoCwd,
    ".agent",
    "test-workspaces",
    "agentfs-audit-db"
  );

  let createTestSession: typeof import("@alfred/test-kit/auth").createTestSession;
  let RuntimeContext: typeof import("@alfred/type/runtime-context").RuntimeContext;
  let appRouter: AppRouter;
  let db: typeof import("@alfred/db").db;
  let auditLogs: typeof import("@alfred/db/schema/policy").auditLogs;

  const TEST_USER = "agentfs-audit-user";

  function createCaller(scopes: string[]) {
    const receivedAt = new Date();
    const runtime = {
      requestId: `test-${Date.now()}`,
      receivedAt,
      method: "POST",
      url: "http://localhost/test",
      ip: null,
      forwardedFor: [] as string[],
      userAgent: null,
      referer: null,
    };
    const runtimeContext = new RuntimeContext([
      ["requestId", runtime.requestId],
      ["receivedAt", receivedAt.toISOString()],
      ["method", runtime.method],
      ["url", runtime.url],
      ["ip", runtime.ip],
      ["forwardedFor", runtime.forwardedFor],
      ["userId", TEST_USER],
      ["userRoles", ["owner"]],
      ["userScopes", scopes],
      ["scanContext", null],
    ]);

    const session = createTestSession({
      id: TEST_USER,
      email: `${TEST_USER}@test.local`,
      name: "Test User",
      roles: ["owner"],
      scopes,
    });

    return appRouter.createCaller({
      session,
      runtime,
      runtimeContext,
      policy: { obligations: [] },
    } as unknown as Parameters<AppRouter["createCaller"]>[0]);
  }

  beforeAll(async () => {
    await import("../utils/mock-metrics");

    ({ createTestSession } = await import("@alfred/test-kit/auth"));
    ({ RuntimeContext } = await import("@alfred/type/runtime-context"));
    ({ appRouter } = await import("@alfred/api/routers/index"));
    ({ db } = await import("@alfred/db"));
    ({ auditLogs } = await import("@alfred/db/schema/policy"));
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
    await mkdir(path.join(rootAbs, ".agentfs"), { recursive: true });
    process.chdir(rootAbs);

    // Reset DB audit rows.
    await db.delete(auditLogs);
  });

  afterAll(async () => {
    try {
      process.chdir(repoCwd);
    } catch {
      // ignore
    }
    await rm(rootAbs, { force: true, recursive: true });
    if (ORIGINAL_DB_URL === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
  });

  it("records op audit rows and queries them via auditRecent", async () => {
    const caller = createCaller(["read:agentfs", "write:agentfs"]);

    await caller.agentfs.pinRun({ runId: "run-1" });

    const recent = await caller.agentfs.auditRecent({ limit: 10 });
    expect(recent.entries.length).toBeGreaterThan(0);
    expect(recent.entries[0]).toMatchObject({
      action: "pin_set",
      runId: "run-1",
      success: true,
    });
  });

  it("records failures with success=false", async () => {
    const caller = createCaller(["read:agentfs", "write:agentfs"]);

    await expect(
      caller.agentfs.casDelete({ sha: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const recent = await caller.agentfs.auditRecent({ limit: 10 });
    expect(recent.entries.length).toBeGreaterThan(0);
    expect(recent.entries[0]).toMatchObject({
      action: "cas_delete",
      success: false,
    });
  });
});
