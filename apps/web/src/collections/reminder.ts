import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection, createOptimisticAction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";
import type { TRPCAppRouter } from "@/utils/trpc";
import type { ReminderResource } from "./schemas";

type ReminderInput = {
  title: string;
  description?: string;
  due: string;
  recurring?: string;
};

function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function createReminderCollection(
  queryClient: QueryClient,
  trpcClient: inferRouterClient<TRPCAppRouter>
) {
  const collection = createCollection(
    queryCollectionOptions<ReminderResource, string>({
      queryKey: ["reminders"],
      queryFn: async () => {
        const reminders = await trpcClient.remind.list.query({ limit: 100 });
        return reminders.map(
          (r): ReminderResource => ({
            id: r.id,
            title: r.title,
            description: r.description ?? null,
            due: toISOString(r.due as Date | string),
            status: r.fired ? "fired" : "scheduled",
            created: toISOString(r.created as Date | string),
            updated: r.firedAt
              ? toISOString(r.firedAt as Date | string)
              : toISOString(r.created as Date | string),
          })
        );
      },
      queryClient,
      getKey: (item) => item.id,

      onInsert: async ({ transaction }) => {
        const items = transaction.mutations.map((m) => m.modified);
        for (const item of items) {
          await trpcClient.remind.create.mutate({
            title: item.title,
            description: item.description ?? undefined,
            due: item.due,
          });
        }
        return { refetch: true };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        for (const id of ids) {
          await trpcClient.remind.delete.mutate({ id });
        }
        return { refetch: true };
      },
    })
  );

  // Optimistic insert action
  const insertReminder = createOptimisticAction<ReminderInput>({
    onMutate: (input) => {
      collection.insert({
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        due: input.due,
        status: "scheduled",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });
      // Return input for mutationFn
      return input;
    },
    mutationFn: async (input) => {
      await trpcClient.remind.create.mutate({
        title: input.title,
        description: input.description ?? undefined,
        due: input.due,
      });
      await collection.utils.refetch();
    },
  });

  // Mark reminder as fired
  const fireReminder = createOptimisticAction<string>({
    onMutate: (id) => {
      collection.update(id, (draft) => {
        draft.status = "fired";
        draft.updated = new Date().toISOString();
      });
      // Return id as context for mutationFn
      return id;
    },
    mutationFn: async (id) => {
      await trpcClient.remind.fire.mutate({ id });
      await collection.utils.refetch();
    },
  });

  // Optimistic delete action
  const deleteReminder = createOptimisticAction<string>({
    onMutate: (id) => {
      collection.delete(id);
      // Return id as context for mutationFn
      return id;
    },
    mutationFn: async (id) => {
      await trpcClient.remind.delete.mutate({ id });
      await collection.utils.refetch();
    },
  });

  return {
    collection,
    insertReminder,
    fireReminder,
    deleteReminder,
  };
}
