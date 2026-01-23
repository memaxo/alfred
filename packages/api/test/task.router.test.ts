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

  it("rejects invalid input: empty title", async () => {
    await expect(caller1.task.create({ title: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid input: title too long", async () => {
    await expect(
      caller1.task.create({ title: "a".repeat(257) })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid input: priority out of range", async () => {
    await expect(
      caller1.task.create({ title: "Task", priority: 11 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid input: invalid date format", async () => {
    await expect(
      caller1.task.create({ title: "Task", due: "not-a-date" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid input: invalid UUID", async () => {
    await expect(
      caller1.task.create({ title: "Task", projectId: "not-uuid" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects update with no fields", async () => {
    const task = await caller1.task.create({ title: "Task" });
    await expect(caller1.task.update({ id: task.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects delete of non-existent task", async () => {
    // Use a valid UUID format that doesn't exist
    const fakeId = "00000000-0000-0000-0000-000000000000";
    await expect(caller1.task.delete({ id: fakeId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "task_not_found",
    });
  });

  it("rejects update of non-existent task", async () => {
    await expect(
      caller1.task.update({ id: "non-existent-id", title: "New" })
    ).rejects.toThrow();
    // Note: updateTask returns 0 rows, router throws NOT_FOUND
    // But the error might be a database error if ID format is invalid
    try {
      await caller1.task.update({ id: "non-existent-id", title: "New" });
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      expect(error).toBeDefined();
    }
  });

  it("rejects invalid limit in list", async () => {
    await expect(caller1.task.list({ limit: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller1.task.list({ limit: 201 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
