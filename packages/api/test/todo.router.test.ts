import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();
const dbDeleteMock = vi.fn();

mock.module("@alfred/db", () => ({
  db: {
    select: () => ({
      from: dbSelectMock,
    }),
    insert: () => ({
      values: dbInsertMock,
    }),
    update: () => ({
      set: dbUpdateMock,
      where: vi.fn(),
    }),
    delete: () => ({
      where: dbDeleteMock,
    }),
  },
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("todo router", () => {
  describe("getAll", () => {
    it("gets all todos", async () => {
      const mockTodos = [
        { id: 1, text: "todo 1", completed: false },
        { id: 2, text: "todo 2", completed: true },
      ];

      dbSelectMock.mockResolvedValue(mockTodos);

      const result = await caller.todo.getAll();

      expect(result).toEqual(mockTodos);
    });
  });

  describe("create", () => {
    it("creates a todo", async () => {
      const mockTodo = { id: 1, text: "new todo", completed: false };
      dbInsertMock.mockResolvedValue([mockTodo]);

      const result = await caller.todo.create({
        text: "new todo",
      });

      expect(dbInsertMock).toHaveBeenCalled();
      expect(result).toEqual([mockTodo]);
    });

    it("validates text length", async () => {
      await expect(
        caller.todo.create({
          text: "",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("toggle", () => {
    it("toggles todo completion", async () => {
      dbUpdateMock.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      await caller.todo.toggle({
        id: 1,
        completed: true,
      });

      expect(dbUpdateMock).toHaveBeenCalledWith({ completed: true });
    });
  });

  describe("delete", () => {
    it("deletes a todo", async () => {
      dbDeleteMock.mockResolvedValue([]);

      await caller.todo.delete({
        id: 1,
      });

      expect(dbDeleteMock).toHaveBeenCalled();
    });
  });
});
