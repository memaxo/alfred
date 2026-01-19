import { beforeAll, describe, expect, it } from "bun:test";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

describe("shortcuts router", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller();
    unauthed = await createUnauthedCaller();
  });

  it("requires authentication", async () => {
    await expect(unauthed.shortcuts.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lists default shortcuts", async () => {
    const list = await caller.shortcuts.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((s) => s.action === "command-palette")).toBe(true);
  });

  it("updates a shortcut with validation", async () => {
    await expect(
      caller.shortcuts.update({ action: 123, shortcut: "⌘K" } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.shortcuts.update({
        action: "command-palette",
        shortcut: 123,
      } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const ok = await caller.shortcuts.update({
      action: "command-palette",
      shortcut: "⌘K",
    });
    expect(ok).toMatchObject({
      success: true,
      action: "command-palette",
      shortcut: "⌘K",
    });
  });

  it("resets shortcuts", async () => {
    const result = await caller.shortcuts.reset();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.shortcuts)).toBe(true);
    expect(result.shortcuts.length).toBeGreaterThan(0);
  });
});
