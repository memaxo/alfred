import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { and, eq, isNull, sql } from "drizzle-orm";
import { workflowRuns } from "../src/schema/workflow";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let db: typeof import("@alfred/db").db;

async function resetWorkflow() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE workflow_events, workflow_runs RESTART IDENTITY CASCADE`
  );
}

describeFn("workflow dreaming (integration)", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "workflow dreaming integration tests need Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    db = mod.db;
  });

  beforeEach(async () => {
    await resetWorkflow();
  });

  it("tracks dreamedAt for failed runs", async () => {
    const [run] = await db
      .insert(workflowRuns)
      .values({
        userId: "user-1",
        workflowId: "wf",
        status: "failed",
        inputData: null,
        stateData: null,
        errorMessage: "failure",
      })
      .returning();

    expect(run).toBeTruthy();
    expect(run?.dreamedAt ?? null).toBeNull();

    const pendingBefore = await db
      .select()
      .from(workflowRuns)
      .where(
        and(eq(workflowRuns.status, "failed"), isNull(workflowRuns.dreamedAt))
      );
    expect(pendingBefore.length).toBe(1);

    await db
      .update(workflowRuns)
      .set({ dreamedAt: new Date() })
      .where(eq(workflowRuns.id, run?.id ?? "missing"));

    const pendingAfter = await db
      .select()
      .from(workflowRuns)
      .where(
        and(eq(workflowRuns.status, "failed"), isNull(workflowRuns.dreamedAt))
      );
    expect(pendingAfter.length).toBe(0);
  });
});
