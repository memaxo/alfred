import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let db: typeof import("@alfred/db").db;
let cognitiveRepo: typeof import("@alfred/db").cognitiveRepo;
let cognitiveSnapshots: typeof import("@alfred/db").cognitiveSnapshots;

async function resetTables() {
  await db.execute(sql`TRUNCATE cognitive_snapshots RESTART IDENTITY CASCADE`);
}

describeFn("cognitiveRepo.findActivePlans", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "cognitiveRepo.findActivePlans tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    db = mod.db;
    cognitiveRepo = mod.cognitiveRepo;
    cognitiveSnapshots = mod.cognitiveSnapshots;
  });

  beforeEach(async () => {
    await resetTables();
  });

  it("returns only streams whose latest snapshot is executing", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 60_000);

    await db.insert(cognitiveSnapshots).values([
      {
        streamId: "s1",
        state: { _: "executing", plan: { steps: [] }, step: 0 },
        lastEventId: randomUUID(),
        createdAt: older,
      },
      {
        streamId: "s1",
        state: { _: "idle" },
        lastEventId: randomUUID(),
        createdAt: now,
      },
      {
        streamId: "s2",
        state: { _: "idle" },
        lastEventId: randomUUID(),
        createdAt: older,
      },
      {
        streamId: "s2",
        state: {
          _: "executing",
          plan: { steps: [{ description: "x" }] },
          step: 0,
        },
        lastEventId: randomUUID(),
        createdAt: now,
      },
      {
        streamId: "s3",
        state: {
          _: "executing",
          plan: { steps: [{ description: "y" }] },
          step: 0,
        },
        lastEventId: randomUUID(),
        createdAt: now,
      },
    ]);

    const active = await cognitiveRepo.findActivePlans();
    const streamIds = active.map((snap) => snap.streamId).sort();

    expect(streamIds).toEqual(["s2", "s3"]);
  });
});
