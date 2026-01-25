import { describeSqlite, requireSqliteTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, expect, it } from "bun:test";

describeSqlite("focus/attention/delta repos (sqlite drift-catcher)", () => {
  let db: typeof import("@alfred/db").db;
  let focusRepo: typeof import("@alfred/db").focusRepo;
  let attentionRepo: typeof import("@alfred/db").attentionRepo;
  let deltaRepo: typeof import("@alfred/db").deltaRepo;

  beforeAll(async () => {
    requireSqliteTestEnv(
      "This test requires sqlite fallback. Ensure DATABASE_URL is sqlite::memory:."
    );
    const mod = await import("@alfred/db");
    ({ db } = mod);
    ({ focusRepo } = mod);
    ({ attentionRepo } = mod);
    ({ deltaRepo } = mod);
    expect(db).toBeTruthy();
  });

  const userId = `sqlite-focus-${crypto.randomUUID()}`;

  beforeEach(async () => {
    // Best-effort cleanup for sqlite fallback; table names must exist for this test to pass.
    // If any of these tables don't exist, the test will fail earlier (which is what we want).
    await db.run("DELETE FROM delta_briefs");
    await db.run("DELETE FROM attention_items");
    await db.run("DELETE FROM focus_commitments");
    await db.run("DELETE FROM focus_sets");
  });

  it("roundtrips focus sets + commitments", async () => {
    const set = await focusRepo.createFocusSet({
      userId,
      title: "Set",
      status: "active",
      wipLimit: 5,
      startsAt: null,
      endsAt: null,
      lastTouchedAt: null,
    });

    const list = await focusRepo.listFocusSets({
      userId,
      status: "active",
      limit: 10,
      offset: 0,
    });

    expect(list.some((r) => r.id === set.id)).toBe(true);

    const c = await focusRepo.createCommitment({
      userId,
      focusSetId: set.id,
      title: "Commitment",
      status: "active",
      lane: "background",
      priority: 0,
      workflowRunId: null,
      conversationId: null,
      lastTouchedAt: null,
      metadata: null,
    });

    const cs = await focusRepo.listCommitments({
      userId,
      focusSetId: set.id,
      limit: 10,
      offset: 0,
    });

    expect(cs.some((r) => r.id === c.id)).toBe(true);
  });

  it("roundtrips attention + delta briefs", async () => {
    await attentionRepo.createAttentionItem({
      userId,
      kind: "test",
      status: "open",
      urgency: "normal",
      title: "Hello",
      body: null,
      payload: null,
      workflowRunId: null,
      focusSetId: null,
      commitmentId: null,
    });

    const items = await attentionRepo.listAttentionItems({
      userId,
      status: "open",
      limit: 10,
      offset: 0,
    });

    expect(items).toHaveLength(1);

    await deltaRepo.createDeltaBrief({
      userId,
      scope: "workflow_run",
      workflowRunId: null,
      focusSetId: null,
      commitmentId: null,
      sinceAt: null,
      untilAt: null,
      summaryText: "Done",
      data: null,
    });

    const briefs = await deltaRepo.listDeltaBriefs({
      userId,
      scope: "workflow_run",
      limit: 10,
      offset: 0,
    });

    expect(briefs).toHaveLength(1);
    expect(briefs[0]?.summaryText).toBe("Done");
  });
});
