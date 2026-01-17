import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { createNoteCollection } from "../note";

// Mock tRPC client - typed to match the expected interface
const mockTrpcClient: Partial<inferRouterClient<TRPCAppRouter>> = {
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
} as inferRouterClient<TRPCAppRouter>;

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
    it("fetches notes correctly", async () => {
      createNoteCollection(queryClient, mockTrpcClient);
      const result = await mockTrpcClient.note.list.query({ limit: 100 });

      expect(mockTrpcClient.note.list.query).toHaveBeenCalledWith({
        limit: 100,
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Existing Note");
    });
  });

  describe("Mutation operations", () => {
    it("creates a note with correct data", async () => {
      const { insertNote } = createNoteCollection(queryClient, mockTrpcClient);
      const newNote = {
        title: "New Note",
        content: "New content",
        tags: [],
      };

      await insertNote(newNote);

      expect(mockTrpcClient.note.create.mutate).toHaveBeenCalledWith({
        title: "New Note",
        content: "New content",
        tags: [],
      });
    });

    it("updates a note with partial data", async () => {
      const { collection, updateNote } = createNoteCollection(
        queryClient,
        mockTrpcClient
      );

      const noteId = "550e8400-e29b-41d4-a716-446655440001";
      collection.insert({
        id: noteId,
        title: "Original",
        content: "Original",
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });

      const update = {
        id: noteId,
        title: "Updated Title",
      };

      await updateNote(update);

      expect(mockTrpcClient.note.update.mutate).toHaveBeenCalledWith({
        id: noteId,
        title: "Updated Title",
        content: undefined,
        tags: undefined,
      });
    });

    it("deletes a note", async () => {
      const { collection, deleteNote } = createNoteCollection(
        queryClient,
        mockTrpcClient
      );
      const noteId = "550e8400-e29b-41d4-a716-446655440001";

      collection.insert({
        id: noteId,
        title: "Original",
        content: "Original",
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });

      await deleteNote(noteId);

      expect(mockTrpcClient.note.delete.mutate).toHaveBeenCalledWith({
        id: noteId,
      });
    });
  });
});
