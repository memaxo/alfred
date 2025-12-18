import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import { db } from "@alfred/db";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();
const dbDeleteMock = vi.fn();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
  vi.restoreAllMocks();
});

describe("todo router", () => {
  describe("getAll", () => {
    it("gets all todos", async () => {
      const mockTodos = [
        { id: 1, text: "todo 1", completed: false },
        { id: 2, text: "todo 2", completed: true },
      ];

      dbSelectMock.mockResolvedValue(mockTodos);
      vi.spyOn(db, "select").mockReturnValue({
        from: dbSelectMock,
      } as unknown as ReturnType<typeof db.select>);

      const result = await caller.todo.getAll();

      expect(result).toEqual(mockTodos);
    });
  });

  describe("create", () => {
    it("creates a todo", async () => {
      const mockTodo = { id: 1, text: "new todo", completed: false };
      dbInsertMock.mockResolvedValue([mockTodo]);
      vi.spyOn(db, "insert").mockReturnValue({
        values: dbInsertMock,
      } as unknown as ReturnType<typeof db.insert>);

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
      const whereMock = vi.fn().mockResolvedValue([]);
      dbUpdateMock.mockReturnValue({ where: whereMock });
      vi.spyOn(db, "update").mockReturnValue({
        set: dbUpdateMock,
      } as unknown as ReturnType<typeof db.update>);

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
      vi.spyOn(db, "delete").mockReturnValue({
        where: dbDeleteMock,
      } as unknown as ReturnType<typeof db.delete>);

      await caller.todo.delete({
        id: 1,
      });

      expect(dbDeleteMock).toHaveBeenCalled();
    });
  });
});
