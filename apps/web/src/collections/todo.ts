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
  id: number | string;
  completed: boolean;
};

function parseServerTodoId(id: number | string): number | null {
  if (typeof id === "number") {
    if (!Number.isFinite(id)) {
      throw new Error("Invalid todo id: non-finite number");
    }
    return id;
  }

  // Optimistic local-only IDs are never persisted server-side.
  if (id.startsWith("temp-")) {
    return null;
  }

  // Allow numeric IDs serialized as strings.
  const parsed = Number(id);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  throw new Error(`Invalid todo id: ${id}`);
}

export function createTodoCollection(
  queryClient: QueryClient,
  trpcClient: inferRouterClient<TRPCAppRouter>
) {
  const collection = createCollection(
    queryCollectionOptions<TodoResource, number | string>({
      queryKey: ["todos"],
      queryFn: async () => {
        const todos = await trpcClient.todo.getAll.query();
        return todos.map(
          (t): TodoResource => ({
            id: t.id,
            text: t.text,
            completed: t.completed ?? false,
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
          const serverId = parseServerTodoId(item.id);
          if (serverId !== null) {
            await trpcClient.todo.toggle.mutate({
              id: serverId,
              completed: item.completed,
            });
          }
        }
        return { refetch: true };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        for (const id of ids) {
          const serverId = parseServerTodoId(id);
          if (serverId !== null) {
            await trpcClient.todo.delete.mutate({ id: serverId });
          }
        }
        return { refetch: true };
      },
    })
  );

  // Optimistic insert action
  const insertTodo = createOptimisticAction<TodoInput>({
    onMutate: (input) => {
      collection.insert({
        id: `temp-${crypto.randomUUID()}`,
        text: input.text,
        completed: false,
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
      });
      return input;
    },
    mutationFn: async (input) => {
      const serverId = parseServerTodoId(input.id);
      if (serverId !== null) {
        await trpcClient.todo.toggle.mutate({
          id: serverId,
          completed: input.completed,
        });
      }
      await collection.utils.refetch();
    },
  });

  // Optimistic delete action
  const deleteTodo = createOptimisticAction<number | string>({
    onMutate: (id) => {
      collection.delete(id);
      return id;
    },
    mutationFn: async (id) => {
      const serverId = parseServerTodoId(id);
      if (serverId !== null) {
        await trpcClient.todo.delete.mutate({ id: serverId });
      }
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
