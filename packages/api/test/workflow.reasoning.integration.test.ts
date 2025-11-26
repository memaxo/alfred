const ORIGINAL_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.OPENAI_API_KEY ??= "test-key";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { Obligation } from "@alfred/type";
import {
  createWorkflowCaller,
  type WorkflowTestUser,
} from "./utils/workflow-caller";

let persistReasoning: typeof import("@alfred/agent/assistant/src/graphstore").persistReasoning;
let workflowRepo: typeof import("@alfred/db/repo/workflow");
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let workflowRunsTable: typeof import("@alfred/db/schema/workflow").workflowRuns;
let workflowEventsTable: typeof import("@alfred/db/schema/workflow").workflowEvents;

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));

mock.module("@alfred/policy", () => ({
  evaluate: async () => ({ allow: true, obligations: [] as Obligation[] }),
  registerCacheObs: () => {},
}));

const TEST_USER: WorkflowTestUser = {
  id: "workflow-integration-user",
  email: "workflow.integration@test.local",
  name: "Workflow Integration",
  roles: ["owner"],
  scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
};

describe("workflow reasoning integration (sqlite)", () => {
  beforeAll(async () => {
    ({ persistReasoning } = await import(
      "../../agent/assistant/src/graphstore.ts"
    ));
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
      process.env.DATABASE_URL = undefined;
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
    const caller = await createWorkflowCaller({ user: TEST_USER });
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
        reasoningSince: now - 1000,
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
