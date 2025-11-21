const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.OPENAI_API_KEY ??= "test-key";

import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { RuntimeContext } from "@alfred/type/runtime-context";

let persistReasoning: typeof import("@alfred/agent/assistant/src/graphstore").persistReasoning;
let workflowRouter: typeof import("@alfred/api/routers/workflow").workflowRouter;
let workflowRepo: typeof import("@alfred/db/repo/workflow");
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let workflowRunsTable: typeof import("@alfred/db/schema/workflow").workflowRuns;
let workflowEventsTable: typeof import("@alfred/db/schema/workflow").workflowEvents;

type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
};

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => undefined,
}));

mock.module("@alfred/policy", () => ({
  evaluate: async () => ({ allow: true, obligations: [] as string[] }),
  registerCacheObs: () => {},
}));

const TEST_USER: SessionUser = {
  id: "workflow-integration-user",
  email: "workflow.integration@test.local",
  name: "Workflow Integration",
  roles: ["owner"],
  scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
};

describe("workflow reasoning integration (sqlite)", () => {
  beforeAll(async () => {
    ({ persistReasoning } = await import("../../agent/assistant/src/graphstore.ts"));
    ({ workflowRouter } = await import("@alfred/api/routers/workflow"));
    workflowRepo = await import("@alfred/db/repo/workflow");
    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const graphSchema = await import("@alfred/db/schema/graph");
    memoryNodes = graphSchema.memoryNodes;
    memoryEdges = graphSchema.memoryEdges;
    const workflowSchema = await import("@alfred/db/schema/workflow");
    workflowRunsTable = workflowSchema.workflowRuns;
    workflowEventsTable = workflowSchema.workflowEvents;
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
    await db.delete(workflowEventsTable).execute();
    await db.delete(workflowRunsTable).execute();
  });

  it("returns reasoning chain persisted by the agent", async () => {
    const caller = createWorkflowCaller();
    const runId = `run-${Date.now()}`;
    const resource = `workspace-${Date.now()}`;
    const now = Date.now();

    await workflowRepo.createRun({
      id: runId,
      userId: TEST_USER.id,
      workflowId: "plan",
      inputData: {
        cw: resource,
        executionId: runId,
        reasoningSince: now - 1_000,
      },
    });

    await persistReasoning(
      resource,
      [
        { text: "Investigate failing build", timestamp: now - 500 },
        { text: "Plan remediation", timestamp: now },
      ],
      { executionId: runId, auto: "low" }
    );

    const result = await caller.reasoning({ runId });

    expect(result.runId).toBe(runId);
    expect(result.chain.length).toBeGreaterThanOrEqual(2);
    expect(result.chain[0]?.text).toContain("Investigate");
    expect(result.chain[1]?.previousHash).toBeTruthy();
  });
});

function createWorkflowCaller() {
  const runtime = {
    requestId: `workflow-test-${Date.now()}`,
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
  ]);

  return workflowRouter.createCaller({
    session: {
      user: TEST_USER,
      session: { id: `sess-${runtime.requestId}` },
    },
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof workflowRouter.createCaller>[0]);
}
