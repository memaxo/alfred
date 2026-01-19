import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

describe("notification router", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller({ userId: "notif-user" });
    unauthed = await createUnauthedCaller();
  });

  beforeEach(async () => {
    // Reset mock prefs (module-level state)
    await caller.notification.setPreferences({
      agentCompletions: true,
      workflowEvents: true,
      systemAlerts: true,
      snoozeUntil: null,
      vacationStart: null,
      vacationEnd: null,
    });
  });

  it("requires authentication", async () => {
    await expect(unauthed.notification.getPreferences()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns defaults", async () => {
    const prefs = await caller.notification.getPreferences();
    expect(prefs).toMatchObject({
      agentCompletions: true,
      workflowEvents: true,
      systemAlerts: true,
    });
  });

  it("merges partial updates", async () => {
    const before = await caller.notification.getPreferences();
    expect(before.workflowEvents).toBe(true);

    const updated = await caller.notification.setPreferences({
      workflowEvents: false,
    });
    expect(updated.workflowEvents).toBe(false);

    const after = await caller.notification.getPreferences();
    expect(after.workflowEvents).toBe(false);
    expect(after.agentCompletions).toBe(true);
  });

  it("accepts date and null fields", async () => {
    const d1 = new Date("2026-01-01T00:00:00.000Z");
    const d2 = new Date("2026-01-02T00:00:00.000Z");

    const updated = await caller.notification.setPreferences({
      snoozeUntil: d1,
      vacationStart: d1,
      vacationEnd: d2,
    });
    expect(updated.snoozeUntil?.toISOString()).toBe(d1.toISOString());
    expect(updated.vacationStart?.toISOString()).toBe(d1.toISOString());
    expect(updated.vacationEnd?.toISOString()).toBe(d2.toISOString());

    const cleared = await caller.notification.setPreferences({
      snoozeUntil: null,
      vacationStart: null,
      vacationEnd: null,
    });
    expect(cleared.snoozeUntil).toBeNull();
    expect(cleared.vacationStart).toBeNull();
    expect(cleared.vacationEnd).toBeNull();
  });
});
