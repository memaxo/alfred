import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { TRPCAppRouter } from "@/utils/trpc";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/todos")({
  component: TodosRoute,
  errorComponent: RouteError,
});

function TodosRoute() {
  const [newTodoText, setNewTodoText] = useState("");

  const utils = trpc.useUtils();
  const todosQuery = trpc.todo.getAll.useQuery();
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type CreateTodoInput = RouterInputs["todo"]["create"];
  type ToggleTodoInput = RouterInputs["todo"]["toggle"];
  type DeleteTodoInput = RouterInputs["todo"]["delete"];
  type TodoItem = RouterOutputs["todo"]["getAll"][number];
  const todos: TodoItem[] = todosQuery.data ?? [];

  const createMutation = trpc.todo.create.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
      setNewTodoText("");
    },
  });
  const toggleMutation = trpc.todo.toggle.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
    },
  });
  const deleteMutation = trpc.todo.delete.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
    },
  });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      const input: CreateTodoInput = { text: newTodoText };
      createMutation.mutate(input);
    }
  };

  const handleToggleTodo = (id: number, completed: boolean) => {
    const input: ToggleTodoInput = { id, completed: !completed };
    toggleMutation.mutate(input);
  };

  const handleDeleteTodo = (id: number) => {
    const input: DeleteTodoInput = { id };
    deleteMutation.mutate(input);
  };

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>Todo List</CardTitle>
          <CardDescription>Manage your tasks efficiently</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-6 flex items-center space-x-2"
            onSubmit={handleAddTodo}
          >
            <Input
              disabled={createMutation.isPending}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a new task..."
              value={newTodoText}
            />
            <Button
              disabled={createMutation.isPending || !newTodoText.trim()}
              type="submit"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </form>

          {todosQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : todos.length === 0 ? (
            <p className="py-4 text-center">No todos yet. Add one above!</p>
          ) : (
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li
                  className="flex items-center justify-between rounded-md border p-2"
                  key={todo.id}
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={todo.completed}
                      id={`todo-${todo.id}`}
                      onCheckedChange={() =>
                        handleToggleTodo(todo.id, todo.completed)
                      }
                    />
                    <label
                      className={`${todo.completed ? "line-through" : ""}`}
                      htmlFor={`todo-${todo.id}`}
                    >
                      {todo.text}
                    </label>
                  </div>
                  <Button
                    aria-label="Delete todo"
                    onClick={() => handleDeleteTodo(todo.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
