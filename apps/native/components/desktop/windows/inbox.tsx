import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

type Status = "new" | "triaged" | "converted" | "archived";

export function InboxWindow({ window: _window }: WindowComponentProps) {
  const [status, setStatus] = useState<Status | "all">("new");
  const [selected, setSelected] = useState<string | null>(null);

  const query = trpc.inbox.list.useQuery({
    status: status === "all" ? undefined : status,
    limit: 50,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
  const selectedItem = useMemo(() => {
    if (!selected) {
      return null;
    }
    return (
      items.find((i: any) => String(i.captureId ?? i.id) === selected) ?? null
    );
  }, [items, selected]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Inbox</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Captures awaiting triage.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["all", "new", "triaged", "converted", "archived"] as const).map(
            (s) => (
              <TouchableOpacity
                className={[
                  "rounded-md border px-3 py-2",
                  s === status
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background",
                ].join(" ")}
                key={s}
                onPress={() => {
                  setSelected(null);
                  setStatus(s);
                }}
              >
                <Text className="text-foreground text-xs">{s}</Text>
              </TouchableOpacity>
            )
          )}
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Items</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : query.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {query.error.message}
          </Text>
        ) : items.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No inbox items.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {items.slice(0, 50).map((it: any) => {
              const id = String(it.captureId ?? it.id ?? "");
              const label = String(it.title ?? it.summary ?? it.text ?? id);
              const isSelected = selected === id;
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={id}
                  onPress={() => setSelected(id)}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {label.slice(0, 120)}
                  </Text>
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    {id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Selected</Text>
        {selectedItem ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(selectedItem, null, 2).slice(0, 4000)}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select an item above.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
