import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller } from "./utils/trpc";
import { mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

const createNoteMock = vi.fn();
const getNotesMock = vi.fn();
const updateNoteMock = vi.fn();
const deleteNoteMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  createNote: createNoteMock,
  getNotes: getNotesMock,
  updateNote: updateNoteMock,
  deleteNote: deleteNoteMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("note router", () => {
  describe("create", () => {
    it("creates a note", async () => {
      const mockNote = {
        id: "note-id",
        userId: "test-user",
        content: "test content",
        createdAt: new Date(),
      };

      createNoteMock.mockResolvedValue(mockNote);

      const result = await caller.note.create({
        content: "test content",
        title: "test title",
        tags: ["tag1"],
      });

      expect(createNoteMock).toHaveBeenCalledWith(
        "test-user",
        "test content",
        "test title",
        ["tag1"]
      );
      expect(result).toEqual(mockNote);
    });

    it("validates required content", async () => {
      await expect(
        caller.note.create({
          content: "",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("lists notes with pagination", async () => {
      const mockNotes = [
        { id: "note-1", content: "content 1" },
        { id: "note-2", content: "content 2" },
      ];

      getNotesMock.mockResolvedValue(mockNotes);

      const result = await caller.note.list({
        limit: 10,
        offset: 0,
      });

      expect(getNotesMock).toHaveBeenCalledWith("test-user", 10, 0);
      expect(result).toEqual(mockNotes);
    });

    it("uses default pagination", async () => {
      getNotesMock.mockResolvedValue([]);

      await caller.note.list({});

      expect(getNotesMock).toHaveBeenCalledWith("test-user", 100, 0);
    });
  });

  describe("update", () => {
    it("updates a note", async () => {
      const mockUpdated = { id: "note-id", content: "updated" };
      updateNoteMock.mockResolvedValue(mockUpdated);

      const result = await caller.note.update({
        id: "note-id",
        content: "updated content",
      });

      expect(updateNoteMock).toHaveBeenCalledWith("note-id", {
        content: "updated content",
      });
      expect(result).toEqual({ updated: mockUpdated });
    });

    it("requires at least one field to update", async () => {
      await expect(
        caller.note.update({
          id: "note-id",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes a note", async () => {
      deleteNoteMock.mockResolvedValue(true);

      const result = await caller.note.delete({
        id: "note-id",
      });

      expect(deleteNoteMock).toHaveBeenCalledWith("note-id");
      expect(result).toEqual({ deleted: true });
    });
  });
});

