import { useEffect, useMemo, useState } from "react";
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function minutesToDueIso(minutes: number): string {
  const safe = Number.isFinite(minutes) ? minutes : 60;
  const ms = Math.max(1, Math.min(60 * 24 * 7, safe)) * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function ReminderWindow({ window, onClose }: WindowComponentProps) {
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const utils = trpc.useUtils();

  const reminderId = asString(
    (window.data as Record<string, unknown>).reminderId
  );

  const listQuery = trpc.remind.list.useQuery({ limit: 200, offset: 0 });
  const reminder = useMemo(() => {
    if (!reminderId) {
      return null;
    }
    return (listQuery.data ?? []).find((r) => r.id === reminderId) ?? null;
  }, [listQuery.data, reminderId]);

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

  useEffect(() => {
    if (reminderId && reminder) {
      setTitle(reminder.title ?? "");
    }
  }, [reminderId, reminder]);

  const fired =
    typeof (reminder as unknown as { fired?: boolean })?.fired === "boolean"
      ? (reminder as unknown as { fired?: boolean }).fired
      : false;

  const due = typeof reminder?.due === "string" ? reminder.due : null;

  const save = () => {
    const t = title.trim();
    if (!t) {
      Alert.alert("Missing title", "Title is required.");
      return;
    }
    if (reminderId) {
      // No update endpoint yet: keep title local, but support core actions (fire/delete).
      updateWindowData(window.id, { label: t });
      return;
    }
    const parsed = Number(mins);
    const dueIso = minutesToDueIso(Number.isFinite(parsed) ? parsed : 60);
    createMutation.mutate(
      { title: t, due: dueIso },
      {
        onSuccess: (created) => {
          updateWindowData(window.id, {
            label: created.title,
            reminderId: created.id,
          });
        },
      }
    );
  };

  const fire = () => {
    if (!reminderId) {
      return;
    }
    fireMutation.mutate({ id: reminderId });
  };

  const del = () => {
    if (!reminderId) {
      onClose();
      return;
    }
    Alert.alert("Delete reminder", "Delete this reminder?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteMutation.mutate(
            { id: reminderId },
            {
              onSuccess: () => {
                onClose();
              },
            }
          ),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          {reminderId ? "Reminder" : "New reminder"}
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          {reminderId ? reminderId : "Not saved yet"}
        </Text>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : reminderId && !reminder ? (
          <Text className="text-muted-foreground text-xs">
            Reminder not found.
          </Text>
        ) : (
          <>
            <Text className="font-medium text-foreground text-sm">Title</Text>
            <TextInput
              className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"
              editable={!createMutation.isPending}
              onChangeText={setTitle}
              placeholder="Reminder title…"
              placeholderTextColor="#6b7280"
              value={title}
            />

            {reminderId ? (
              due ? (
                <Text className="mt-3 text-muted-foreground text-xs">
                  Due: {due}
                </Text>
              ) : null
            ) : (
              <>
                <Text className="mt-4 font-medium text-foreground text-sm">
                  Due (minutes from now)
                </Text>
                <TextInput
                  className="mt-2 w-32 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  editable={!createMutation.isPending}
                  keyboardType="number-pad"
                  onChangeText={setMins}
                  placeholder="60"
                  placeholderTextColor="#6b7280"
                  value={mins}
                />
              </>
            )}

            <View className="mt-4 flex-row flex-wrap gap-2">
              <TouchableOpacity
                className="rounded-md bg-primary px-4 py-2"
                disabled={createMutation.isPending || title.trim().length === 0}
                onPress={save}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="font-medium text-primary-foreground text-sm">
                    {reminderId ? "Save label" : "Create"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-md bg-secondary px-4 py-2"
                disabled={!reminderId || fireMutation.isPending || fired}
                onPress={fire}
              >
                <Text className="font-medium text-secondary-foreground text-sm">
                  Fire
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-md bg-destructive/10 px-4 py-2"
                disabled={deleteMutation.isPending}
                onPress={del}
              >
                <Text className="font-medium text-destructive text-sm">
                  {reminderId ? "Delete" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
