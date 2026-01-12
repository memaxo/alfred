import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER_ID = "trajectory-repo-test-user";

let db: typeof import("@alfred/db").db;
let workflowRepo: typeof import("@alfred/db").workflowRepo;
let trajectoryRepo: typeof import("@alfred/db").trajectoryRepo;

async function ensureUser() {
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${TEST_USER_ID}, 'Test User', 'trajectory@test.com', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

async function resetTables() {
  await db.execute(
    sql`TRUNCATE workflow_trajectories, workflow_events, workflow_runs RESTART IDENTITY CASCADE`
  );
}

describeFn("trajectoryRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "trajectoryRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    db = mod.db;
    workflowRepo = mod.workflowRepo;
    trajectoryRepo = mod.trajectoryRepo;
    await ensureUser();
  });

  beforeEach(async () => {
    await resetTables();
  });

  it("upserts and fetches a trajectory by runId", async () => {
    const run = await workflowRepo.createRun({
      userId: TEST_USER_ID,
      workflowId: "plan",
      status: "completed",
      requirement: "test",
    });

    const stored = await trajectoryRepo.upsertTrajectory({
      runId: run.id,
      format: "atif",
      schemaVersion: "ATIF-v1.4",
      data: { schema_version: "ATIF-v1.4", session_id: run.id, steps: [] },
      lastEventId: null,
      lastSeq: null,
      valid: true,
      errors: null,
    });

    expect(stored.runId).toBe(run.id);
    expect(stored.format).toBe("atif");

    const fetched = await trajectoryRepo.getTrajectoryByRunId({
      runId: run.id,
      format: "atif",
    });
    expect(fetched?.id).toBe(stored.id);
  });

  it("derives a run event marker from workflow events", async () => {
    const run = await workflowRepo.createRun({
      userId: TEST_USER_ID,
      workflowId: "plan",
      status: "running",
    });

    await workflowRepo.appendEvent({
      runId: run.id,
      eventType: "notice",
      eventId: "00000000-0000-0000-0000-000000000001",
      eventData: { message: "hello" },
      timestamp: new Date("2025-01-01T00:00:00.000Z"),
      seq: 10,
    });

    const marker = await trajectoryRepo.getRunEventMarker(run.id);
    expect(marker.lastEventId).toBe("00000000-0000-0000-0000-000000000001");
    expect(marker.lastSeq).toBe(10);
  });
});
