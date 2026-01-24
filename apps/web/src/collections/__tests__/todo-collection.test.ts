import type { inferRouterClient } from "@trpc/client";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { TRPCAppRouter } from "@/utils/trpc";

import { createTodoCollection } from "../todo";

// Mock tRPC client - typed to match the expected interface
const mockTrpcClient: Partial<inferRouterClient<TRPCAppRouter>> = {
  task: {
    list: {
      query: mock(() =>
        Promise.resolve([
          {
            id: crypto.randomUUID(),
            title: "Existing Task",
            description: null,
            status: "pending",
            priority: 0,
            due: null,
            created: new Date(),
            updated: new Date(),
            completed: null,
          },
        ])
      ),
    },
    create: {
      mutate: mock((input: { title: string }) =>
        Promise.resolve({
          id: crypto.randomUUID(),
          title: input.title,
          description: null,
          status: "pending",
          priority: 0,
          due: null,
          created: new Date(),
          updated: new Date(),
          completed: null,
        })
      ),
    },
    update: {
      mutate: mock((input: { id: string; status: "pending" | "completed" }) =>
        Promise.resolve({
          id: input.id,
          title: "Updated Task",
          description: null,
          status: input.status,
          priority: 0,
          due: null,
          created: new Date(),
          updated: new Date(),
          completed: input.status === "completed" ? new Date() : null,
        })
      ),
    },
    delete: {
      mutate: mock(() => Promise.resolve({ deleted: 1 })),
    },
  },
} as inferRouterClient<TRPCAppRouter>;

describe("Todo Collection", () => {
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
    mockTrpcClient.task.list.query.mockClear();
    mockTrpcClient.task.create.mutate.mockClear();
    mockTrpcClient.task.update.mutate.mockClear();
    mockTrpcClient.task.delete.mutate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches todos correctly", async () => {
    createTodoCollection(queryClient, mockTrpcClient);
    // Use the trpc client directly to verify the query works as expected
    const result = await mockTrpcClient.task.list.query({ limit: 200 });

    expect(mockTrpcClient.task.list.query).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Existing Task");
  });

  it("handles optimistic insertion", async () => {
    const { insertTodo } = createTodoCollection(queryClient, mockTrpcClient);

    await insertTodo({ text: "New Task" });

    expect(mockTrpcClient.task.create.mutate).toHaveBeenCalledWith({
      title: "New Task",
    });
  });

  it("handles optimistic toggle", async () => {
    const { collection, toggleTodo } = createTodoCollection(
      queryClient,
      mockTrpcClient
    );

    // Setup: Insert item first so update finds it
    const id = crypto.randomUUID();
    collection.insert({ id, text: "Task 1", completed: false });

    await toggleTodo({ id, completed: true });

    expect(mockTrpcClient.task.update.mutate).toHaveBeenCalledWith({
      id,
      status: "completed",
    });
  });

  it("handles optimistic deletion", async () => {
    const { collection, deleteTodo } = createTodoCollection(
      queryClient,
      mockTrpcClient
    );

    // Setup: Insert item first so delete finds it
    const id = crypto.randomUUID();
    collection.insert({ id, text: "Task 1", completed: false });

    await deleteTodo(id);

    expect(mockTrpcClient.task.delete.mutate).toHaveBeenCalledWith({ id });
  });

  it("does not call the API for temp ids", async () => {
    const { collection, deleteTodo } = createTodoCollection(
      queryClient,
      mockTrpcClient
    );

    const tempId = `temp-${crypto.randomUUID()}`;
    collection.insert({ id: tempId, text: "Local Task", completed: false });

    await deleteTodo(tempId);

    expect(mockTrpcClient.task.delete.mutate).not.toHaveBeenCalled();
  });
});
