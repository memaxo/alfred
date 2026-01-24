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

export function TimersWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const activeQuery = trpc.timer.active.useQuery(undefined, { retry: false });
  const create = trpc.timer.create.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
    },
  });
  const done = trpc.timer.done.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
    },
  });
  const cancel = trpc.timer.cancel.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
    },
  });

  const [minutes, setMinutes] = useState("5");
  const [label, setLabel] = useState("");

  const timers = useMemo(
    () => (activeQuery.data as any[]) ?? [],
    [activeQuery.data]
  );

  const add = () => {
    const m = Number(minutes);
    const durationMin = Number.isFinite(m)
      ? Math.max(1, Math.min(24 * 60, m))
      : 5;
    create.mutate({
      duration: durationMin * 60,
      label: label.trim().length > 0 ? label.trim() : undefined,
    });
    setLabel("");
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Timers</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Start a timer and mark it done.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">New timer</Text>
        <View className="mt-3 flex-row gap-2">
          <TextInput
            className="w-24 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            keyboardType="number-pad"
            onChangeText={setMinutes}
            placeholder="mins"
            placeholderTextColor="#6b7280"
            value={minutes}
          />
          <TextInput
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            onChangeText={setLabel}
            placeholder="Optional label"
            placeholderTextColor="#6b7280"
            value={label}
          />
        </View>
        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-primary px-3 py-2"
          disabled={create.isPending}
          onPress={add}
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="font-medium text-primary-foreground text-sm">
              Start
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Active</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={activeQuery.isFetching}
            onPress={() => void activeQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {activeQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : activeQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {activeQuery.error.message}
          </Text>
        ) : timers.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No active timers.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {timers.map((t: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(t.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(t.label ?? "Timer")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  id: {String(t.id)}
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <TouchableOpacity
                    className="rounded-md bg-secondary px-3 py-2"
                    disabled={done.isPending}
                    onPress={() => done.mutate({ id: t.id })}
                  >
                    <Text className="text-secondary-foreground text-xs">
                      Done
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-md bg-destructive/10 px-3 py-2"
                    disabled={cancel.isPending}
                    onPress={() =>
                      Alert.alert("Cancel timer", "Cancel this timer?", [
                        { text: "Keep", style: "cancel" },
                        {
                          text: "Cancel",
                          style: "destructive",
                          onPress: () => cancel.mutate({ id: t.id }),
                        },
                      ])
                    }
                  >
                    <Text className="text-destructive text-xs">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
