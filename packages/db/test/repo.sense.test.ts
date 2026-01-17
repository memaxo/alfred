import { describe, expect, it } from "bun:test";

async function loadSenseRepo() {
  // Force sqlite for deterministic unit tests even when DATABASE_URL is set.
  process.env.DATABASE_URL = "sqlite::memory:";
  const mod = await import("../src/repo/sense");
  return mod;
}

describe("senseRepo (sqlite)", () => {
  it("creates capture + bundle + receipt and lists inbox", async () => {
    const { createBundle, createCapture, listInbox, upsertReceipt } =
      await loadSenseRepo();

    const capture = await createCapture({
      userId: "u1",
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

    const rows = await listInbox({ userId: "u1", limit: 10 });
    const row = rows.find((r) => r.capture.id === capture.id) ?? null;

    expect(row).not.toBeNull();
    expect(row?.bundle?.id).toBe(bundle.id);
    expect(row?.receipt?.id).toBe(receipt.id);
  });

  it("supports working set get/set", async () => {
    const { getInboxItem, getWorkingSet, setWorkingSet } =
      await loadSenseRepo();

    const initial = await getWorkingSet("u2");
    expect(initial.userId).toBe("u2");
    expect(initial.items.length).toBe(0);

    const updated = await setWorkingSet({
      userId: "u2",
      items: [{ kind: "project", id: "p1", label: "Project" }],
      focus: { kind: "project", id: "p1", label: "Project" },
    });

    expect(updated.items.length).toBe(1);
    expect(updated.focus?.id).toBe("p1");

    const item = await getInboxItem({ userId: "u2", captureId: "missing" });
    expect(item).toBeNull();
  });
});
