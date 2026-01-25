import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let db: typeof import("@alfred/db").db;
let codexRunRepo: typeof import("@alfred/db").codexRunRepo;

async function resetCodexRuns() {
  await db.execute(
    sql`TRUNCATE codex_events, codex_runs RESTART IDENTITY CASCADE`
  );
}

describeFn("codexRunRepo (integration)", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "codexRunRepo integration tests need Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ db } = mod);
    ({ codexRunRepo } = mod);
  });

  beforeEach(async () => {
    await resetCodexRuns();
  });

  it("creates runs, appends event batches idempotently, and lists/searches events", async () => {
    const run = await codexRunRepo.createRun({
      userId: "user-1",
      sessionId: "sess-1",
      threadId: "thread-1",
      environmentKind: "host",
      workingDirectory: "/tmp/repo",
      status: "running",
      outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
    });

    await codexRunRepo.appendEventsBatch({
      runId: run.id,
      events: [
        {
          seq: 1,
          eventType: "stdout",
          eventData: { type: "stdout", text: "hello world" },
          text: "hello world",
        },
        {
          seq: 2,
          eventType: "thread_event",
          eventData: { type: "turn.started" },
          text: "turn started",
        },
      ],
    });

    // Idempotent insert: duplicate (run_id, seq) should not create extra rows
    const dup = await codexRunRepo.appendEventsBatch({
      runId: run.id,
      events: [
        {
          seq: 1,
          eventType: "stdout",
          eventData: { type: "stdout", text: "hello world" },
          text: "hello world",
        },
      ],
    });
    expect(dup.inserted).toBe(0);

    const eventsAsc = await codexRunRepo.listEvents({
      runId: run.id,
      order: "asc",
    });
    expect(eventsAsc.map((e) => e.seq)).toEqual([1, 2]);
    expect(eventsAsc[0]?.eventType).toBe("stdout");

    const found = await codexRunRepo.searchEvents({
      userId: "user-1",
      query: "hello",
      runId: run.id,
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.text ?? "").toContain("hello");

    const latest = await codexRunRepo.getLatestRunBySession({
      userId: "user-1",
      sessionId: "sess-1",
    });
    expect(latest?.id).toBe(run.id);
  });

  it("prunes old terminal runs and old events via retention function", async () => {
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const run = await codexRunRepo.createRun({
      userId: "user-2",
      sessionId: "sess-2",
      status: "completed",
      environmentKind: "host",
      startedAt: oldDate,
    });

    await codexRunRepo.appendEventsBatch({
      runId: run.id,
      events: [
        {
          seq: 1,
          eventType: "stdout",
          text: "old output",
          createdAt: oldDate,
        },
      ],
    });

    const pruned = await codexRunRepo.pruneOldRuns(0);
    expect(pruned.deletedEvents).toBeGreaterThanOrEqual(1);
    expect(pruned.deletedRuns).toBeGreaterThanOrEqual(1);

    const fetched = await codexRunRepo.getRun(run.id);
    expect(fetched).toBeNull();
  });
});
