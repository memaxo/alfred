/**
 * Timers List Screen
 *
 * Displays active timers and allows creating new ones.
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { useTimerNotifications } from "@/hooks/use-timer-notifications";
import {
  useTimerActive,
  useTimerCancel,
  useTimerCreate,
  useTimerDone,
} from "@/hooks/use-trpc";
import { haptics } from "@/lib/haptics";

export default function TimersListScreen() {
  const _router = useRouter();
  const [duration, setDuration] = useState("");
  const [label, setLabel] = useState("");

  const timersQuery = useTimerActive();
  useTimerNotifications(timersQuery.data ?? []);

  // Refetch every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      timersQuery.refetch();
    }, 1000);
    return () => clearInterval(interval);
  }, [timersQuery]);

  const createMutation = useTimerCreate();
  const doneMutation = useTimerDone();
  const cancelMutation = useTimerCancel();

  useEffect(() => {
    if (createMutation.isSuccess) {
      timersQuery.refetch();
      setDuration("");
      setLabel("");
    }
  }, [createMutation.isSuccess, timersQuery]);

  useEffect(() => {
    if (doneMutation.isSuccess || cancelMutation.isSuccess) {
      timersQuery.refetch();
    }
  }, [doneMutation.isSuccess, cancelMutation.isSuccess, timersQuery]);

  const handleCreate = useCallback(() => {
    const seconds = Number.parseInt(duration, 10);
    if (Number.isNaN(seconds) || seconds <= 0) {
      haptics.error();
      Alert.alert("Invalid Duration", "Please enter a valid number of seconds");
      return;
    }
    haptics.success();
    createMutation.mutate({
      duration: seconds,
      label: label.trim() || undefined,
    });
  }, [duration, label, createMutation]);

  const handleDone = useCallback(
    (timerId: string) => {
      haptics.success();
      doneMutation.mutate({ id: timerId });
    },
    [doneMutation]
  );

  const handleCancel = useCallback(
    (timerId: string) => {
      haptics.light();
      cancelMutation.mutate({ id: timerId });
    },
    [cancelMutation]
  );

  const formatTimeRemaining = (timer: any) => {
    const now = Date.now();
    const endTime = new Date(timer.endTime).getTime();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <Container>
      <Stack.Screen
        options={{
          title: "Timers",
        }}
      />

      <View className="flex-1">
        {/* Create timer form */}
        <View className="border-border border-b bg-background px-4 py-4">
          <Text className="mb-2 font-semibold text-foreground">New Timer</Text>
          <View className="flex-row gap-2">
            <TextInput
              accessibilityLabel="Timer duration in seconds"
              accessibilityRole="text"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              keyboardType="numeric"
              onChangeText={setDuration}
              placeholder="Duration (seconds)"
              placeholderTextColor="#5A6B7D"
              value={duration}
            />
            <TextInput
              accessibilityLabel="Timer label"
              accessibilityRole="text"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              onChangeText={setLabel}
              placeholder="Label (optional)"
              placeholderTextColor="#5A6B7D"
              value={label}
            />
            <TouchableOpacity
              accessibilityLabel="Start timer"
              accessibilityRole="button"
              accessibilityState={{
                disabled: createMutation.isPending || !duration,
              }}
              className="rounded-lg bg-primary px-4 py-2"
              disabled={createMutation.isPending || !duration}
              onPress={handleCreate}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons color="#FFFFFF" name="play" size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Active timers list */}
        {timersQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFB800" size="large" />
          </View>
        ) : timersQuery.data && timersQuery.data.length > 0 ? (
          <FlatList
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            data={timersQuery.data}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                onRefresh={() => timersQuery.refetch()}
                refreshing={timersQuery.isRefetching}
              />
            }
            renderItem={({ item }) => (
              <View className="mb-3 rounded-lg border border-border bg-card p-4">
                <View className="mb-2 flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text
                      accessibilityRole="header"
                      className="mb-1 font-semibold text-foreground text-lg"
                    >
                      {item.label || "Timer"}
                    </Text>
                    <View
                      accessibilityLabel={`Time remaining: ${formatTimeRemaining(item)}`}
                      className="flex-row items-center gap-2"
                    >
                      <Ionicons
                        color="#FFB800"
                        name="timer-outline"
                        size={16}
                      />
                      <Text className="font-mono text-foreground text-lg">
                        {formatTimeRemaining(item)}
                      </Text>
                    </View>
                  </View>
                  <View className="ml-2 flex-row gap-2">
                    <TouchableOpacity
                      accessibilityLabel="Mark timer as done"
                      accessibilityRole="button"
                      onPress={() => handleDone(item.id)}
                    >
                      <Ionicons
                        color="#00FF88"
                        name="checkmark-circle"
                        size={24}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel="Cancel timer"
                      accessibilityRole="button"
                      onPress={() => handleCancel(item.id)}
                    >
                      <Ionicons color="#FF3366" name="close-circle" size={24} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons color="#5A6B7D" name="timer-outline" size={48} />
            <Text className="mt-4 text-center text-lg text-muted-foreground">
              No active timers. Create one above!
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
}
