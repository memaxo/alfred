import { beforeAll, describe, expect, it } from "bun:test";

import { createTestCaller } from "./utils/trpc";

describe("concierge routers validation", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller();
  });

  it("rejects invalid UUID inputs", async () => {
    await expect(
      caller.attention.resolve({ id: "not-a-uuid" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.focus.update({
        id: "not-a-uuid",
        title: null,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects out-of-bounds wipLimit", async () => {
    await expect(
      caller.focus.create({
        title: "Too small",
        wipLimit: 0,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.focus.create({
        title: "Too large",
        wipLimit: 999,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
