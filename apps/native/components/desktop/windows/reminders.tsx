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

function minutesToDueIso(minutes: number): string {
  const safe = Number.isFinite(minutes) ? minutes : 60;
  const ms = Math.max(1, Math.min(60 * 24 * 7, safe)) * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function RemindersWindow(_props: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const utils = trpc.useUtils();
  const query = trpc.remind.list.useQuery({ limit: 100, offset: 0 });

  const createMutation = trpc.remind.create.useMutation({
    onSuccess: async () => {
      await utils.remind.list.invalidate();
    },
  });
  const fireMutation = trpc.remind.fire.useMutation({
    onSuccess: async () => {
      await utils.remind.list.invalidate();
    },
  });
  const deleteMutation = trpc.remind.delete.useMutation({
    onSuccess: async () => {
      await utils.remind.list.invalidate();
    },
  });

  const [title, setTitle] = useState("");
  const [mins, setMins] = useState("60");

  const reminders = useMemo(() => query.data ?? [], [query.data]);

  const add = () => {
    const t = title.trim();
    if (!t) {
      return;
    }
    const parsed = Number(mins);
    const due = minutesToDueIso(Number.isFinite(parsed) ? parsed : 60);
    createMutation.mutate({ title: t, due });
    setTitle("");
  };

  const fire = (id: string) => {
    fireMutation.mutate({ id });
  };

  const del = (id: string) => {
    Alert.alert("Delete reminder", "Delete this reminder?", [
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
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              Reminders
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Schedule something to remember.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Create reminder window"
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => openWindow("reminder", { label: "New reminder" })}
          >
            <Text className="font-medium text-secondary-foreground text-sm">
              Open
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!createMutation.isPending}
            onChangeText={setTitle}
            onSubmitEditing={add}
            placeholder="Reminder title…"
            placeholderTextColor="#6b7280"
            returnKeyType="done"
            value={title}
          />
          <TextInput
            className="w-20 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            editable={!createMutation.isPending}
            keyboardType="number-pad"
            onChangeText={setMins}
            placeholder="mins"
            placeholderTextColor="#6b7280"
            value={mins}
          />
          <TouchableOpacity
            className={[
              "rounded-md px-4 py-2",
              title.trim().length === 0 || createMutation.isPending
                ? "bg-muted"
                : "bg-primary",
            ].join(" ")}
            disabled={title.trim().length === 0 || createMutation.isPending}
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
        <Text className="font-medium text-foreground text-sm">Scheduled</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : reminders.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No reminders yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {reminders.map((r) => {
              const due = typeof r.due === "string" ? r.due : null;
              const fired =
                typeof (r as { fired?: boolean }).fired === "boolean"
                  ? (r as { fired?: boolean }).fired
                  : false;
              return (
                <TouchableOpacity
                  className="rounded-md border border-border bg-background p-3"
                  key={r.id}
                  onPress={() =>
                    openWindow("reminder", { label: r.title, reminderId: r.id })
                  }
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-medium text-foreground text-sm">
                      {r.title}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {fired ? "fired" : "scheduled"}
                    </Text>
                  </View>
                  {due ? (
                    <Text className="mt-1 text-muted-foreground text-xs">
                      Due: {due}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row gap-2">
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      disabled={fireMutation.isPending || fired}
                      onPress={() => fire(r.id)}
                    >
                      <Text className="text-secondary-foreground text-xs">
                        Fire
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="rounded-md bg-destructive/10 px-3 py-2"
                      disabled={deleteMutation.isPending}
                      onPress={() => del(r.id)}
                    >
                      <Text className="text-destructive text-xs">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
