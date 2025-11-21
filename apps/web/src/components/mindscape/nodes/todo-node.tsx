import type { NodeProps } from "@xyflow/react";
import { CheckSquare, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MindscapeNode } from "./mindscape-node";
import { todoNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
] as const;

export function TodoNode({ id, data, selected }: NodeProps) {
  const parsed = todoNodeDataSchema.safeParse(data);
  const filter = parsed.success ? parsed.data.filter ?? "all" : "all";
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const [text, setText] = useState("");
  const utils = trpc.useUtils();
  const todosQuery = trpc.todo.getAll.useQuery();
  const todos = todosQuery.data ?? [];

  const createTodo = trpc.todo.create.useMutation({
    onSuccess: async () => {
      toast.success("Todo added");
      setText("");
      await utils.todo.getAll.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to add todo"),
  });

  const toggleTodo = trpc.todo.toggle.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to update todo"),
  });

  const deleteTodo = trpc.todo.delete.useMutation({
    onSuccess: async () => {
      toast.success("Todo removed");
      await utils.todo.getAll.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to delete todo"),
  });

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case "active":
        return todos.filter((todo) => !todo.completed);
      case "completed":
        return todos.filter((todo) => todo.completed);
      default:
        return todos;
    }
  }, [todos, filter]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      return;
    }
    createTodo.mutate({ text });
  };

  const handleFilterChange = (value: "all" | "active" | "completed") => {
    updateArtifactData(id, { filter: value });
  };

  return (
    <MindscapeNode
      className="w-[320px] border-emerald-500/20 bg-emerald-950/10"
      headerActions={<CheckSquare className="h-4 w-4 text-emerald-300" />}
      id={id}
      selected={selected}
      title="Todos"
    >
      <div className="flex flex-col gap-3 p-4">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <Input
            onChange={(event) => setText(event.target.value)}
            placeholder="Add a task"
            value={text}
          />
          <Button
            disabled={createTodo.isPending || !text.trim()}
            type="submit"
          >
            {createTodo.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </form>

        <div className="flex gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              onClick={() => handleFilterChange(item.value)}
              size="sm"
              variant={filter === item.value ? "default" : "ghost"}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[220px] rounded-md border border-white/10 p-2">
          {todosQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-biolum-faint text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filteredTodos.length === 0 ? (
            <p className="py-4 text-center text-sm text-biolum-faint">
              {filter === "completed"
                ? "No completed tasks yet"
                : "Nothing here yet"}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredTodos.map((todo) => (
                <li
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2"
                  key={todo.id}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={todo.completed}
                      id={`todo-${todo.id}`}
                      onCheckedChange={() =>
                        toggleTodo.mutate({
                          id: todo.id,
                          completed: !todo.completed,
                        })
                      }
                    />
                    <label
                      className={`text-sm ${todo.completed ? "text-biolum-faint line-through" : "text-biolum"}`}
                      htmlFor={`todo-${todo.id}`}
                    >
                      {todo.text}
                    </label>
                  </div>
                  <Button
                    aria-label="Delete todo"
                    onClick={() => deleteTodo.mutate({ id: todo.id })}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-emerald-200" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </MindscapeNode>
  );
}
