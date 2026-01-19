import { beforeAll, describe, expect, it } from "bun:test";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

describe("task router", () => {
  let caller1: Awaited<ReturnType<typeof createTestCaller>>;
  let caller2: Awaited<ReturnType<typeof createTestCaller>>;
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    caller1 = await createTestCaller({ userId: "task-user-1" });
    caller2 = await createTestCaller({ userId: "task-user-2" });
    unauthed = await createUnauthedCaller();
  });

  it("requires authentication", async () => {
    await expect(unauthed.task.list({ limit: 10 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("creates and lists tasks scoped to user", async () => {
    const t1 = await caller1.task.create({
      title: "Task 1",
      priority: 3,
    });
    const t2 = await caller2.task.create({
      title: "Task 2",
      priority: 1,
    });

    const list1 = await caller1.task.list({ limit: 50 });
    const list2 = await caller2.task.list({ limit: 50 });

    expect(list1.some((t) => t.id === t1.id)).toBe(true);
    expect(list1.some((t) => t.id === t2.id)).toBe(false);

    expect(list2.some((t) => t.id === t2.id)).toBe(true);
    expect(list2.some((t) => t.id === t1.id)).toBe(false);
  });

  it("rejects updates for tasks owned by another user", async () => {
    const other = await caller2.task.create({ title: "Other task" });

    await expect(
      caller1.task.update({ id: other.id, title: "Nope" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
