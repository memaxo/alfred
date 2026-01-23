import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function CortexWindow(_props: WindowComponentProps) {
  const stateQuery = trpc.cognitive.state.useQuery({ streamId: "default" });
  const physQuery = trpc.cognitive.physiologyGet.useQuery({
    streamId: "default",
  });

  const stateText = useMemo(() => {
    try {
      return JSON.stringify(stateQuery.data ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, [stateQuery.data]);

  const physText = useMemo(() => {
    try {
      return JSON.stringify(physQuery.data ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, [physQuery.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              Cortex
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Cognitive state snapshot.
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => {
              void stateQuery.refetch();
              void physQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">State</Text>
        {stateQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : stateQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {stateQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
            {stateText}
          </Text>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Physiology</Text>
        {physQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : physQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {physQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
            {physText}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
