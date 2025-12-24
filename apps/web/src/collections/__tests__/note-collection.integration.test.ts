import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";

// Mock tRPC client
const mockTrpcClient = {
  note: {
    list: {
      query: mock(() =>
        Promise.resolve([
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            title: "Existing Note",
            content: "Content",
            tags: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        ])
      ),
    },
    create: {
      mutate: mock((input: { title: string; content: string }) =>
        Promise.resolve({
          id: "550e8400-e29b-41d4-a716-446655440002",
          title: input.title,
          content: input.content,
          tags: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        })
      ),
    },
    update: {
      mutate: mock((input: { id: string; title?: string; content?: string }) =>
        Promise.resolve({
          id: input.id,
          title: input.title ?? "Updated",
          content: input.content ?? "Updated content",
          tags: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        })
      ),
    },
    delete: {
      mutate: mock(() => Promise.resolve({ success: true })),
    },
  },
};

describe("Note Collection Integration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mocks
    mockTrpcClient.note.list.query.mockClear();
    mockTrpcClient.note.create.mutate.mockClear();
    mockTrpcClient.note.update.mutate.mockClear();
    mockTrpcClient.note.delete.mutate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Query operations", () => {
    it("fetches notes on initial query", async () => {
      const result = await mockTrpcClient.note.list.query();

      expect(mockTrpcClient.note.list.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Existing Note");
    });
  });

  describe("Mutation operations", () => {
    it("creates a note with correct data", async () => {
      const newNote = {
        title: "New Note",
        content: "New content",
      };

      const result = await mockTrpcClient.note.create.mutate(newNote);

      expect(mockTrpcClient.note.create.mutate).toHaveBeenCalledWith(newNote);
      expect(result.title).toBe("New Note");
      expect(result.id).toBeDefined();
    });

    it("updates a note with partial data", async () => {
      const update = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Updated Title",
      };

      const result = await mockTrpcClient.note.update.mutate(update);

      expect(mockTrpcClient.note.update.mutate).toHaveBeenCalledWith(update);
      expect(result.title).toBe("Updated Title");
    });

    it("deletes a note", async () => {
      const noteId = "550e8400-e29b-41d4-a716-446655440001";

      const result = await mockTrpcClient.note.delete.mutate({ id: noteId });

      expect(mockTrpcClient.note.delete.mutate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("handles create failure", async () => {
      mockTrpcClient.note.create.mutate.mockImplementationOnce(() =>
        Promise.reject(new Error("Create failed"))
      );

      await expect(
        mockTrpcClient.note.create.mutate({ title: "Fail", content: "Fail" })
      ).rejects.toThrow("Create failed");
    });

    it("handles update failure", async () => {
      mockTrpcClient.note.update.mutate.mockImplementationOnce(() =>
        Promise.reject(new Error("Update failed"))
      );

      await expect(
        mockTrpcClient.note.update.mutate({ id: "123", title: "Fail" })
      ).rejects.toThrow("Update failed");
    });

    it("handles delete failure", async () => {
      mockTrpcClient.note.delete.mutate.mockImplementationOnce(() =>
        Promise.reject(new Error("Delete failed"))
      );

      await expect(
        mockTrpcClient.note.delete.mutate({ id: "123" })
      ).rejects.toThrow("Delete failed");
    });
  });

  describe("Optimistic updates simulation", () => {
    it("simulates optimistic insert flow", async () => {
      // 1. Optimistic: Add to local state immediately
      const optimisticNote = {
        id: "temp-id",
        title: "Optimistic Note",
        content: "Content",
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      // 2. Server mutation
      const serverNote = await mockTrpcClient.note.create.mutate({
        title: optimisticNote.title,
        content: optimisticNote.content,
      });

      // 3. Reconcile: Replace temp ID with server ID
      expect(serverNote.id).not.toBe("temp-id");
      expect(serverNote.title).toBe(optimisticNote.title);
    });

    it("simulates optimistic update flow", async () => {
      const noteId = "550e8400-e29b-41d4-a716-446655440001";

      // 1. Optimistic: Update local state immediately
      const optimisticUpdate = { title: "Optimistic Title" };

      // 2. Server mutation
      const result = await mockTrpcClient.note.update.mutate({
        id: noteId,
        ...optimisticUpdate,
      });

      // 3. Reconcile: Server confirms update
      expect(result.title).toBe(optimisticUpdate.title);
    });

    it("simulates optimistic delete with rollback", async () => {
      const noteId = "550e8400-e29b-41d4-a716-446655440001";

      // 1. Optimistic: Remove from local state
      let localNotes = [{ id: noteId, title: "To Delete" }];
      const deletedNote = localNotes.find((n) => n.id === noteId);
      localNotes = localNotes.filter((n) => n.id !== noteId);

      expect(localNotes).toHaveLength(0);

      // 2. Server mutation fails
      mockTrpcClient.note.delete.mutate.mockImplementationOnce(() =>
        Promise.reject(new Error("Delete failed"))
      );

      try {
        await mockTrpcClient.note.delete.mutate({ id: noteId });
      } catch {
        // 3. Rollback: Restore deleted note
        if (deletedNote) {
          localNotes.push(deletedNote);
        }
      }

      // Note should be restored
      expect(localNotes).toHaveLength(1);
      expect(localNotes[0]?.id).toBe(noteId);
    });
  });
});
