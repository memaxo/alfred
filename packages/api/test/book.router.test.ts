import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const createBookmarkMock = vi.fn();
const getBookmarksMock = vi.fn();
const deleteBookmarkMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  createBookmark: createBookmarkMock,
  getBookmarks: getBookmarksMock,
  deleteBookmark: deleteBookmarkMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("book router", () => {
  describe("create", () => {
    it("creates a bookmark", async () => {
      const mockBookmark = {
        id: "bookmark-id",
        userId: "test-user",
        url: "https://example.com",
        title: "Example",
      };

      createBookmarkMock.mockResolvedValue(mockBookmark);

      const result = await caller.book.create({
        url: "https://example.com",
        title: "Example",
        description: "Example site",
        tags: ["web"],
      });

      expect(createBookmarkMock).toHaveBeenCalledWith(
        "test-user",
        "https://example.com",
        "Example",
        "Example site",
        ["web"]
      );
      expect(result).toEqual(mockBookmark);
    });

    it("validates URL format", async () => {
      await expect(
        caller.book.create({
          url: "not-a-url",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("lists bookmarks with pagination", async () => {
      const mockBookmarks = [
        { id: "bookmark-1", url: "https://example.com" },
        { id: "bookmark-2", url: "https://test.com" },
      ];

      getBookmarksMock.mockResolvedValue(mockBookmarks);

      const result = await caller.book.list({
        limit: 10,
        offset: 0,
      });

      expect(getBookmarksMock).toHaveBeenCalledWith("test-user", 10, 0);
      expect(result).toEqual(mockBookmarks);
    });
  });

  describe("delete", () => {
    it("deletes a bookmark", async () => {
      deleteBookmarkMock.mockResolvedValue(true);
      const id = "00000000-0000-0000-0000-000000000000";

      const result = await caller.book.delete({
        id,
      });

      expect(deleteBookmarkMock).toHaveBeenCalledWith(id);
      expect(result).toEqual({ deleted: true });
    });
  });
});
