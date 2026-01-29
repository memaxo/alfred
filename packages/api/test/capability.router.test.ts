import { describe, expect, it } from "bun:test";

import { createTestCaller } from "./utils/trpc";

describe("capability router", () => {
  it("returns a stable, non-empty capability list", async () => {
    const caller = await createTestCaller();
    const list = await caller.capability.list();

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    const ids = list.map((c) => String(c.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("chat.send");
  });
});
