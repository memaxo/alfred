import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection, createOptimisticAction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";
import type { TRPCAppRouter } from "@/utils/trpc";
import type { NoteResource } from "./schemas";

type NoteInput = Omit<NoteResource, "id" | "created" | "updated">;
type NoteUpdate = { id: string } & Partial<
  Omit<NoteResource, "id" | "created">
>;

export function createNoteCollection(
  queryClient: QueryClient,
  trpcClient: inferRouterClient<TRPCAppRouter>
) {
  const collection = createCollection(
    queryCollectionOptions<NoteResource, string>({
      queryKey: ["notes"],
      queryFn: async () => {
        const notes = await trpcClient.note.list.query({ limit: 100 });
        return notes.map(
          (n): NoteResource => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags,
            created: n.created.toISOString(),
            updated: n.updated.toISOString(),
          })
        );
      },
      queryClient,
      getKey: (item) => item.id,

      onInsert: async ({ transaction }) => {
        const items = transaction.mutations.map((m) => m.modified);
        for (const item of items) {
          await trpcClient.note.create.mutate({
            title: item.title ?? undefined,
            content: item.content,
            tags: item.tags ?? undefined,
          });
        }
        return { refetch: true };
      },

      onUpdate: async ({ transaction }) => {
        const items = transaction.mutations.map((m) => m.modified);
        for (const item of items) {
          await trpcClient.note.update.mutate({
            id: item.id,
            title: item.title ?? undefined,
            content: item.content ?? undefined,
            tags: item.tags ?? undefined,
          });
        }
        return { refetch: true };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        for (const id of ids) {
          await trpcClient.note.delete.mutate({ id });
        }
        return { refetch: true };
      },
    })
  );

  // Optimistic insert action
  const insertNote = createOptimisticAction<NoteInput>({
    onMutate: (note) => {
      collection.insert({
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...note,
      });
    },
    mutationFn: async () => {
      await collection.utils.refetch();
    },
  });

  // Optimistic update action
  const updateNote = createOptimisticAction<NoteUpdate>({
    onMutate: (input) => {
      collection.update(input.id, (draft) => {
        if (input.title !== undefined) {
          draft.title = input.title;
        }
        if (input.content !== undefined) {
          draft.content = input.content;
        }
        if (input.tags !== undefined) {
          draft.tags = input.tags;
        }
        draft.updated = new Date().toISOString();
      });
    },
    mutationFn: async () => {
      await collection.utils.refetch();
    },
  });

  // Optimistic delete action
  const deleteNote = createOptimisticAction<string>({
    onMutate: (id) => {
      collection.delete(id);
    },
    mutationFn: async () => {
      await collection.utils.refetch();
    },
  });

  return {
    collection,
    insertNote,
    updateNote,
    deleteNote,
  };
}
