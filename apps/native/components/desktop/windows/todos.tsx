import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

type FilterValue = "all" | "active" | "completed";

function asFilter(value: unknown): FilterValue {
  if (value === "active" || value === "completed" || value === "all") {
    return value;
  }
  return "all";
}

export function TodosWindow({ window }: WindowComponentProps) {
  const utils = trpc.useUtils();
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const query = trpc.task.list.useQuery({ limit: 200 });
  const createMutation = trpc.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const updateMutation = trpc.task.update.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });

  const [draft, setDraft] = useState("");
  const filter = asFilter((window.data as Record<string, unknown>).filter);

  const tasks = query.data ?? [];
  const filtered = useMemo(() => {
    switch (filter) {
      case "active":
        return tasks.filter((t) => t.status !== "completed");
      case "completed":
        return tasks.filter((t) => t.status === "completed");
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const add = () => {
    const title = draft.trim();
    if (!title) {
      return;
    }
    createMutation.mutate({ title });
    setDraft("");
  };

  const toggle = (id: string, nextCompleted: boolean) => {
    updateMutation.mutate({
      id,
      status: nextCompleted ? "completed" : "pending",
    });
  };

  const del = (id: string) => {
    Alert.alert("Delete task", "Delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id }),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Todos</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Capture tasks and mark them complete.
        </Text>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["all", "active", "completed"] as const).map((f) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                f === filter
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={f}
              onPress={() => updateWindowData(window.id, { filter: f })}
            >
              <Text className="text-foreground text-xs">{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!createMutation.isPending}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add a new task…"
            placeholderTextColor="#6b7280"
            returnKeyType="done"
            value={draft}
          />
          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              draft.trim().length === 0 || createMutation.isPending
                ? "bg-muted"
                : "bg-primary",
            ].join(" ")}
            disabled={draft.trim().length === 0 || createMutation.isPending}
            onPress={add}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="font-medium text-primary-foreground text-sm">
                Add
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Tasks</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : filtered.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Nothing here yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {filtered.map((t) => {
              const done = t.status === "completed";
              return (
                <View
                  className="flex-row items-center justify-between rounded-md border border-border bg-background p-3"
                  key={t.id}
                >
                  <TouchableOpacity
                    accessibilityLabel={
                      done ? "Mark incomplete" : "Mark complete"
                    }
                    className="mr-3 h-10 w-10 items-center justify-center rounded-md bg-muted/30"
                    onPress={() => toggle(t.id, !done)}
                  >
                    <Text className="text-foreground">{done ? "✓" : "○"}</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <Text
                      className={[
                        "text-foreground text-sm",
                        done ? "text-muted-foreground line-through" : "",
                      ].join(" ")}
                      numberOfLines={2}
                    >
                      {t.title}
                    </Text>
                    <Text className="mt-1 text-[10px] text-muted-foreground">
                      {t.status}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Delete task"
                    className="ml-2 rounded-md bg-destructive/10 px-3 py-2"
                    onPress={() => del(t.id)}
                  >
                    <Text className="text-destructive text-xs">Del</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
