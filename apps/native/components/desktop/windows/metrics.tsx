import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function MetricsWindow(_props: WindowComponentProps) {
  const snapshotQuery = trpc.metrics.getSnapshot.useQuery(undefined, {
    retry: false,
  });

  const [modelId, setModelId] = useState("openai:gpt-4o-mini");
  const [inputTokens, setInputTokens] = useState("1000");
  const [outputTokens, setOutputTokens] = useState("500");

  const costQuery = trpc.metrics.estimateCost.useQuery(
    {
      modelId,
      usage: {
        inputTokens: Number(inputTokens) || 0,
        outputTokens: Number(outputTokens) || 0,
      },
    },
    { enabled: false, retry: false }
  );

  const snapshotText = useMemo(() => {
    try {
      return JSON.stringify(snapshotQuery.data ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, [snapshotQuery.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Metrics</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Snapshot + cost estimation.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Snapshot</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={snapshotQuery.isFetching}
            onPress={() => void snapshotQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {snapshotQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : (snapshotQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {snapshotQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
            {snapshotText.slice(0, 4000)}
          </Text>
        ))}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">
          Cost estimate
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Estimate token cost for a model.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          onChangeText={setModelId}
          placeholder="provider:model"
          placeholderTextColor="#6b7280"
          value={modelId}
        />
        <View className="mt-2 flex-row gap-2">
          <TextInput
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            keyboardType="number-pad"
            onChangeText={setInputTokens}
            placeholder="input"
            placeholderTextColor="#6b7280"
            value={inputTokens}
          />
          <TextInput
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            keyboardType="number-pad"
            onChangeText={setOutputTokens}
            placeholder="output"
            placeholderTextColor="#6b7280"
            value={outputTokens}
          />
        </View>
        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-primary px-3 py-2"
          disabled={costQuery.isFetching}
          onPress={() => void costQuery.refetch()}
        >
          {costQuery.isFetching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="font-medium text-primary-foreground text-sm">
              Estimate
            </Text>
          )}
        </TouchableOpacity>

        {costQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {costQuery.error.message}
          </Text>
        ) : (costQuery.data ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(costQuery.data, null, 2)}
          </Text>
        ) : null)}
      </View>
    </ScrollView>
  );
}
