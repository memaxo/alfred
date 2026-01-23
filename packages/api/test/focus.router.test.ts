import { describe, expect, test } from "bun:test";
import { createTestCaller } from "./utils/trpc";

describe("focus router", () => {
  test("creates and reads active focus set", async () => {
    const caller = await createTestCaller();

    const created = await caller.focus.create({
      title: "Today",
      wipLimit: 3,
    });

    expect(created.id).toBeTruthy();
    expect(created.wipLimit).toBe(3);

    const active = await caller.focus.active();
    expect(active?.id).toBe(created.id);
  });

  test("creates and lists commitments", async () => {
    const caller = await createTestCaller();

    const set = await caller.focus.create({ title: "Set", wipLimit: 5 });
    const commitment = await caller.focus.commitmentCreate({
      focusSetId: set.id,
      title: "Ship Concierge Focus",
      lane: "spotlight",
      priority: 1,
    });

    expect(commitment.focusSetId).toBe(set.id);
    expect(commitment.title).toBe("Ship Concierge Focus");

    const list = await caller.focus.commitmentList({ focusSetId: set.id });
    expect(list).toHaveLength(1);
  });
});
