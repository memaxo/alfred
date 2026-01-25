/**
 * Sense Repository Tests
 *
 * These tests require Postgres with the sense schema tables.
 * Run with: RUN_DB_TESTS=1 bun test test/repo.sense.test.ts
 */

import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

import * as senseRepo from "../src/repo/sense";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER = "repo-sense-test";

let db: typeof import("@alfred/db").db;

async function resetSenseTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE sense_captures, sense_bundles, sense_receipts, sense_workingsets RESTART IDENTITY CASCADE`
  );
}

describeFn("senseRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "senseRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ db } = mod);
  });

  beforeEach(async () => {
    await resetSenseTables();
  });

  it("creates capture + bundle + receipt and lists inbox", async () => {
    const { createBundle, createCapture, listInbox, upsertReceipt } = senseRepo;

    const capture = await createCapture({
      userId: TEST_USER,
      kind: "text",
      evidence: { capturedAt: new Date("2025-01-01T00:00:00.000Z") },
    });

    const bundle = await createBundle({
      captureId: capture.id,
      text: "hello from sense",
    });

    const receipt = await upsertReceipt({
      captureId: capture.id,
      decision: "route",
      summary: "Suggested note as a durable capture.",
      evidence: [{ key: "payload.text", label: "Derived text available" }],
      outcome: { kind: "note" },
      alternatives: [{ kind: "reminder" }, { kind: "inbox" }],
      confidence: 0.7,
      corrections: [],
    });

    const rows = await listInbox({ userId: TEST_USER, limit: 10 });
    const row = rows.find((r) => r.capture.id === capture.id) ?? null;

    expect(row).not.toBeNull();
    expect(row?.bundle?.id).toBe(bundle.id);
    expect(row?.receipt?.id).toBe(receipt.id);
  });

  it("supports working set get/set", async () => {
    const { getInboxItem, getWorkingSet, setWorkingSet } = senseRepo;

    const initial = await getWorkingSet(TEST_USER);
    expect(initial.userId).toBe(TEST_USER);
    expect(initial.items.length).toBe(0);

    const updated = await setWorkingSet({
      userId: TEST_USER,
      items: [{ kind: "project", id: "p1", label: "Project" }],
      focus: { kind: "project", id: "p1", label: "Project" },
    });

    expect(updated.items.length).toBe(1);
    expect(updated.focus?.id).toBe("p1");

    const item = await getInboxItem({
      userId: TEST_USER,
      captureId: "missing",
    });
    expect(item).toBeNull();
  });
});
