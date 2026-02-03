import type { NodeProps } from "@xyflow/react";

import { useLiveQuery } from "@tanstack/react-db";
import { CheckSquare, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { TodoResource } from "@/collections/schemas";

import { useTodoCollection } from "@/collections/provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useAppForm } from "@/form";
import { useDesktopStore } from "@/store/desktop";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

const todoWindowDataSchema = z.object({
  type: z.literal("todo"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  filter: z.enum(["all", "active", "completed"]).optional(),
});

export function TodoWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = todoWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "todo" as const, viewMode: "full" as const };

  const [filter, setFilter] = useState<FilterValue>(windowData.filter ?? "all");
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const { collection, insertTodo, toggleTodo, deleteTodo } =
    useTodoCollection();

  const { data: todos = [], isLoading } = useLiveQuery(
    (q) => q.from({ todo: collection }).select(({ todo }) => todo),
    [collection]
  );

  const filteredTodos = useMemo(() => {
    const list = todos as TodoResource[];
    switch (filter) {
      case "active": {
        return list.filter((todo) => !todo.completed);
      }
      case "completed": {
        return list.filter((todo) => todo.completed);
      }
      default: {
        return list;
      }
    }
  }, [todos, filter]);

  const form = useAppForm({
    defaultValues: {
      text: "",
    },
    onSubmit: ({ value }) => {
      const trimmed = value.text.trim();
      if (!trimmed) {
        return;
      }
      insertTodo({ text: trimmed });
      form.reset();
    },
  });

  const handleFilterChange = (value: FilterValue) => {
    setFilter(value);
    updateWindowData(id, { draft: { filter: value } });
  };

  if (lod === "tiny") {
    return <TinyDot color="bg-emerald-500" shadow="shadow-emerald-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-emerald-500/20"
        hoverColor="hover:border-emerald-500/40"
        icon={<CheckSquare className="h-3 w-3" />}
        label="Todos"
        textColor="text-emerald-500"
      />
    );
  }

  return (
    <WindowFrame
      actions={<CheckSquare className="h-4 w-4 text-emerald-300" />}
      id={id}
      selected={selected}
      title="Todos"
      width={340}
      windowType="todo"
    >
      <div className="flex flex-col gap-3 p-4">
        <form.AppForm>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.AppField name="text">
              {(field) => (
                <Input
                  aria-invalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Add a task"
                  value={field.state.value}
                />
              )}
            </form.AppField>
            <form.Subscribe
              selector={(state) => ({
                text: state.values.text,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ text, isSubmitting }) => (
                <Button
                  disabled={isSubmitting || text.trim().length === 0}
                  type="submit"
                >
                  Add
                </Button>
              )}
            </form.Subscribe>
          </form>
        </form.AppForm>

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
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-biolum-faint text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filteredTodos.length === 0 ? (
            <p className="py-4 text-center text-biolum-faint text-sm">
              {filter === "completed"
                ? "No completed tasks yet"
                : filter === "active"
                  ? "All tasks completed!"
                  : "No tasks yet"}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredTodos.map((todo) => (
                <li
                  className="flex items-center justify-between gap-2 rounded border border-white/5 bg-white/5 p-2"
                  key={todo.id}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() =>
                        toggleTodo({
                          id: todo.id,
                          completed: !todo.completed,
                        })
                      }
                    />
                    <span
                      className={
                        todo.completed
                          ? "text-biolum-faint line-through"
                          : "text-white"
                      }
                    >
                      {todo.text}
                    </span>
                  </div>
                  <Button
                    onClick={() => deleteTodo(todo.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </WindowFrame>
  );
}
