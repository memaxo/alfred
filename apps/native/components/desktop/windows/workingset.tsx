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
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

type ItemKind = "project" | "conversation" | "note" | "reminder" | "task";

export function WorkingsetWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const query = trpc.workingset.get.useQuery();
  const mutation = trpc.workingset.set.useMutation({
    onSuccess: async () => {
      await utils.workingset.get.invalidate();
    },
  });

  const [kind, setKind] = useState<ItemKind>("note");
  const [itemId, setItemId] = useState("");
  const [label, setLabel] = useState("");

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const focus = query.data?.focus ?? null;

  const setItems = (next: typeof items) => {
    mutation.mutate({
      items: next,
      focus: focus ?? undefined,
    });
  };

  const addItem = () => {
    const trimmed = itemId.trim();
    if (!trimmed) {
      return;
    }
    const next = items.concat({
      kind,
      id: trimmed,
      label: label.trim() || undefined,
    });
    setItems(next.slice(0, 20));
    setItemId("");
    setLabel("");
  };

  const removeItem = (idx: number) => {
    const next = items.slice(0, idx).concat(items.slice(idx + 1));
    setItems(next);
  };

  const setFocus = (idx: number) => {
    const item = items[idx];
    if (!item) {
      return;
    }
    mutation.mutate({ items, focus: item });
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          Working Set
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Curate up to 20 active resources (project, note, reminder, task).
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Add item</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(
            ["project", "conversation", "note", "reminder", "task"] as const
          ).map((k) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                k === kind
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={k}
              onPress={() => setKind(k)}
            >
              <Text className="text-foreground text-xs">{k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setItemId}
          placeholder="Resource id"
          placeholderTextColor="#6b7280"
          value={itemId}
        />
        <TextInput
          className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setLabel}
          placeholder="Optional label"
          placeholderTextColor="#6b7280"
          value={label}
        />

        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-primary px-3 py-2"
          disabled={mutation.isPending || itemId.trim().length === 0}
          onPress={addItem}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="font-medium text-primary-foreground text-sm">
              Add
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Items</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : items.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Empty. Add a resource above.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {items.map((it, idx) => {
              const isFocused = focus?.kind === it.kind && focus?.id === it.id;
              return (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={`${it.kind}_${it.id}_${idx}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-medium text-foreground text-sm">
                      {it.label ?? it.id}
                    </Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className={[
                          "rounded-md px-3 py-2",
                          isFocused ? "bg-primary/20" : "bg-secondary",
                        ].join(" ")}
                        onPress={() => setFocus(idx)}
                      >
                        <Text className="text-secondary-foreground text-xs">
                          {isFocused ? "Focused" : "Focus"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="rounded-md bg-destructive/10 px-3 py-2"
                        onPress={() =>
                          Alert.alert(
                            "Remove item",
                            "Remove this item from the working set?",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => removeItem(idx),
                              },
                            ]
                          )
                        }
                      >
                        <Text className="text-destructive text-xs">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {it.kind}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
