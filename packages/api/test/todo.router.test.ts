import { beforeAll, describe, expect, it } from "bun:test";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["read:todos", "write:todos"],
  });
});

describe("todo router", () => {
  it("is deprecated in favor of tasks", async () => {
    await expect(caller.todo.getAll()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "todo_deprecated_use_task",
    });

    await expect(caller.todo.create({ text: "x" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "todo_deprecated_use_task",
    });

    await expect(
      caller.todo.toggle({ id: 1, completed: true })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "todo_deprecated_use_task",
    });

    await expect(caller.todo.delete({ id: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "todo_deprecated_use_task",
    });
  });
});
