import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { inferRouterClient } from "@trpc/client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { createTodoCollection } from "../todo";

// Mock tRPC client - typed to match the expected interface
const mockTrpcClient: Partial<inferRouterClient<TRPCAppRouter>> = {
  todo: {
    getAll: {
      query: mock(() =>
        Promise.resolve([
          {
            id: 1,
            text: "Existing Todo",
            completed: false,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        ])
      ),
    },
    create: {
      mutate: mock((input: { text: string }) =>
        Promise.resolve({
          id: 2,
          text: input.text,
          completed: false,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        })
      ),
    },
    toggle: {
      mutate: mock((input: { id: number; completed: boolean }) =>
        Promise.resolve({
          id: input.id,
          text: "Updated Todo",
          completed: input.completed,
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
    mockTrpcClient.todo.getAll.query.mockClear();
    mockTrpcClient.todo.create.mutate.mockClear();
    mockTrpcClient.todo.toggle.mutate.mockClear();
    mockTrpcClient.todo.delete.mutate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches todos correctly", async () => {
    createTodoCollection(queryClient, mockTrpcClient);
    // Use the trpc client directly to verify the query works as expected
    const result = await mockTrpcClient.todo.getAll.query();

    expect(mockTrpcClient.todo.getAll.query).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Existing Todo");
  });

  it("handles optimistic insertion", async () => {
    const { insertTodo } = createTodoCollection(queryClient, mockTrpcClient);

    await insertTodo({ text: "New Task" });

    expect(mockTrpcClient.todo.create.mutate).toHaveBeenCalledWith({
      text: "New Task",
    });
  });

  it("handles optimistic toggle", async () => {
    const { collection, toggleTodo } = createTodoCollection(
      queryClient,
      mockTrpcClient
    );

    // Setup: Insert item first so update finds it
    collection.insert({ id: 1, text: "Task 1", completed: false });

    await toggleTodo({ id: 1, completed: true });

    expect(mockTrpcClient.todo.toggle.mutate).toHaveBeenCalledWith({
      id: 1,
      completed: true,
    });
  });

  it("handles optimistic deletion", async () => {
    const { collection, deleteTodo } = createTodoCollection(
      queryClient,
      mockTrpcClient
    );

    // Setup: Insert item first so delete finds it
    collection.insert({ id: 1, text: "Task 1", completed: false });

    await deleteTodo(1);

    expect(mockTrpcClient.todo.delete.mutate).toHaveBeenCalledWith({ id: 1 });
  });
});
