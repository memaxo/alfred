import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection, createOptimisticAction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";
import type { TRPCAppRouter } from "@/utils/trpc";
import type { TodoResource } from "./schemas";

type TodoInput = {
  text: string;
};

type TodoToggleInput = {
  id: string;
  completed: boolean;
};

export function createTodoCollection(
  queryClient: QueryClient,
  trpcClient: inferRouterClient<TRPCAppRouter>
) {
  const collection = createCollection(
    queryCollectionOptions<TodoResource, string>({
      queryKey: ["todos"],
      queryFn: async () => {
        const todos = await trpcClient.todo.getAll.query();
        return todos.map(
          (t): TodoResource => ({
            id: t.id,
            text: t.text,
            completed: t.completed ?? false,
            created: t.created ?? new Date().toISOString(),
            updated: t.updated ?? t.created ?? new Date().toISOString(),
          })
        );
      },
      queryClient,
      getKey: (item) => item.id,

      onInsert: async ({ transaction }) => {
        const items = transaction.mutations.map((m) => m.modified);
        for (const item of items) {
          await trpcClient.todo.create.mutate({
            text: item.text,
          });
        }
        return { refetch: true };
      },

      onUpdate: async ({ transaction }) => {
        const items = transaction.mutations.map((m) => m.modified);
        for (const item of items) {
          await trpcClient.todo.toggle.mutate({
            id: item.id,
            completed: item.completed,
          });
        }
        return { refetch: true };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        for (const id of ids) {
          await trpcClient.todo.delete.mutate({ id });
        }
        return { refetch: true };
      },
    })
  );

  // Optimistic insert action
  const insertTodo = createOptimisticAction<TodoInput>({
    onMutate: (input) => {
      collection.insert({
        id: crypto.randomUUID(),
        text: input.text,
        completed: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });
      return input;
    },
    mutationFn: async (input) => {
      await trpcClient.todo.create.mutate({ text: input.text });
      await collection.utils.refetch();
    },
  });

  // Optimistic toggle action
  const toggleTodo = createOptimisticAction<TodoToggleInput>({
    onMutate: (input) => {
      collection.update(input.id, (draft) => {
        draft.completed = input.completed;
        draft.updated = new Date().toISOString();
      });
      return input;
    },
    mutationFn: async (input) => {
      await trpcClient.todo.toggle.mutate({
        id: input.id,
        completed: input.completed,
      });
      await collection.utils.refetch();
    },
  });

  // Optimistic delete action
  const deleteTodo = createOptimisticAction<string>({
    onMutate: (id) => {
      collection.delete(id);
      return id;
    },
    mutationFn: async (id) => {
      await trpcClient.todo.delete.mutate({ id });
      await collection.utils.refetch();
    },
  });

  return {
    collection,
    insertTodo,
    toggleTodo,
    deleteTodo,
  };
}
