import { describe, expect, it } from "bun:test";

import { nextDueAt, normalizeRecurring } from "../../src/scheduler/cron";

describe("cron helper", () => {
  it("normalizes 5-field cron by prefixing seconds", () => {
    const out = normalizeRecurring(
      "0 9 * * 1",
      new Date("2025-01-27T12:00:00Z"),
      "UTC"
    );
    expect(out.kind).toBe("cron");
    expect(out.cron).toBe("0 0 9 * * 1");
  });

  it("normalizes daily to same local wall-clock time", () => {
    const out = normalizeRecurring(
      "daily",
      new Date("2025-01-27T11:00:00Z"),
      "UTC"
    );
    expect(out.kind).toBe("shortcut");
    expect(out.cron).toBe("0 0 11 * * *");
  });

  it("normalizes weekly to same local weekday + time", () => {
    const out = normalizeRecurring(
      "weekly",
      // 2025-01-27 is Monday
      new Date("2025-01-27T11:00:00Z"),
      "UTC"
    );
    expect(out.kind).toBe("shortcut");
    expect(out.cron).toBe("0 0 11 * * 1");
  });

  it("normalizes monthly to same local day-of-month + time", () => {
    const out = normalizeRecurring(
      "monthly",
      new Date("2025-01-27T11:00:00Z"),
      "UTC"
    );
    expect(out.kind).toBe("shortcut");
    expect(out.cron).toBe("0 0 11 27 * *");
  });

  it("computes nextDueAt for daily in UTC", () => {
    const next = nextDueAt({
      recurring: "daily",
      after: new Date("2025-01-27T12:00:00Z"),
      baseDueAt: new Date("2025-01-27T11:00:00Z"),
      tz: "UTC",
    });
    expect(next).toEqual(new Date("2025-01-28T11:00:00.000Z"));
  });

  it("computes nextDueAt in non-UTC timezone preserving local time", () => {
    // 2025-01-27T08:00:00-08:00 == 2025-01-27T16:00:00Z
    const baseDueAt = new Date("2025-01-27T16:00:00Z");
    const next = nextDueAt({
      recurring: "daily",
      after: new Date("2025-01-27T18:00:00Z"),
      baseDueAt,
      tz: "America/Los_Angeles",
    });
    // Next day 08:00 -08:00 == 2025-01-28T16:00:00Z
    expect(next).toEqual(new Date("2025-01-28T16:00:00.000Z"));
  });

  it("handles DST transition (Europe/London) without throwing", () => {
    // DST starts 2025-03-30 in Europe/London.
    // Base: 01:00 local on 2025-03-29; next should exist and be > after.
    const baseDueAt = new Date("2025-03-29T01:00:00.000Z");
    const after = new Date("2025-03-29T02:00:00.000Z");
    const next = nextDueAt({
      recurring: "daily",
      after,
      baseDueAt,
      tz: "Europe/London",
    });
    expect(next.getTime()).toBeGreaterThan(after.getTime());
  });

  it("throws when maxTransitions is exhausted", () => {
    expect(() =>
      nextDueAt({
        recurring: "0 0 0 1 1 *", // once per year
        after: new Date("2025-01-02T00:00:00.000Z"),
        baseDueAt: new Date("2025-01-01T00:00:00.000Z"),
        tz: "UTC",
        maxTransitions: 0,
      })
    ).toThrow(/cron_next_due_exceeded/);
  });
});
