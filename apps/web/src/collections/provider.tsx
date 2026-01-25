import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";

import type { TRPCAppRouter } from "@/utils/trpc";

import { createNoteCollection } from "./note";
import { createReminderCollection } from "./reminder";
import { createTodoCollection } from "./todo";

type NoteCollectionType = ReturnType<typeof createNoteCollection>;
type ReminderCollectionType = ReturnType<typeof createReminderCollection>;
type TodoCollectionType = ReturnType<typeof createTodoCollection>;

interface CollectionsContextValue {
  notes: NoteCollectionType;
  reminders: ReminderCollectionType;
  todos: TodoCollectionType;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

interface CollectionsProviderProps extends PropsWithChildren {
  queryClient: QueryClient;
  trpcClient: inferRouterClient<TRPCAppRouter>;
}

export function CollectionsProvider({
  children,
  queryClient,
  trpcClient,
}: CollectionsProviderProps) {
  const collections = useMemo(
    () => ({
      notes: createNoteCollection(queryClient, trpcClient),
      reminders: createReminderCollection(queryClient, trpcClient),
      todos: createTodoCollection(queryClient, trpcClient),
    }),
    [queryClient, trpcClient]
  );

  return (
    <CollectionsContext.Provider value={collections}>
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections(): CollectionsContextValue {
  const ctx = useContext(CollectionsContext);
  if (!ctx) {
    throw new Error("useCollections must be used within CollectionsProvider");
  }
  return ctx;
}

export function useNoteCollection(): NoteCollectionType {
  return useCollections().notes;
}

export function useReminderCollection(): ReminderCollectionType {
  return useCollections().reminders;
}

export function useTodoCollection(): TodoCollectionType {
  return useCollections().todos;
}
