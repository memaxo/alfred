process.env.DATABASE_URL = "sqlite::memory:";

import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

let WorkflowTestHarness: typeof import("./workflow-server").WorkflowTestHarness;
let auth: typeof import("@alfred/auth").auth;
let db: typeof import("@alfred/db").db;
let workflowRuns: typeof import("@alfred/db/schema/workflow").workflowRuns;

beforeAll(async () => {
  ({ WorkflowTestHarness } = await import("./workflow-server"));
  ({ auth } = await import("@alfred/auth"));
  const dbModule = await import("@alfred/db");
  db = dbModule.db;
  workflowRuns = dbModule.workflowSchema.workflowRuns;
});

describe("WorkflowTestHarness", () => {
  let harness: WorkflowTestHarness | null = null;

  afterEach(async () => {
    if (harness) {
      await harness.reset();
      await harness.close();
      harness = null;
    }
  });

  it("injects sessions through headers without mocking auth", async () => {
    harness = new WorkflowTestHarness();
    const headers = harness.headers();
    const session = await auth.api.getSession({ headers });
    expect(session?.user?.id).toBe(harness.user.id);
  });

  it("resets workflow tables between runs", async () => {
    harness = new WorkflowTestHarness();

    await db.insert(workflowRuns).values({
      id: randomUUID(),
      userId: harness.user.id,
      workflowId: randomUUID(),
      status: "running",
    });

    const before = await db.select().from(workflowRuns);
    expect(before.length).toBeGreaterThan(0);

    await harness.reset();

    const after = await db.select().from(workflowRuns);
    expect(after.length).toBe(0);
  });
});
