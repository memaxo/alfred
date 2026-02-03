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

export function VisualWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const query = trpc.visual.getConfig.useQuery(undefined, { retry: false });
  const preset = trpc.visual.setPreset.useMutation({
    onSuccess: async () => {
      await utils.visual.getConfig.invalidate();
    },
  });

  const currentPreset = useMemo(() => {
    const p = (query.data as any)?.preset;
    return typeof p === "string" ? p : "balanced";
  }, [query.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          Visual Builder
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Control Mindscape/Cortex visual presets.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Preset</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : query.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {query.error.message}
          </Text>
        ) : (
          <>
            <Text className="mt-2 text-muted-foreground text-xs">
              current: {currentPreset}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(["minimal", "balanced", "performance", "maximum"] as const).map(
                (p) => (
                  <TouchableOpacity
                    className={[
                      "rounded-md border px-3 py-2",
                      p === currentPreset
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background",
                    ].join(" ")}
                    disabled={preset.isPending}
                    key={p}
                    onPress={() => preset.mutate({ preset: p })}
                  >
                    <Text className="text-foreground text-xs">{p}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Raw config</Text>
        {query.data ? (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(query.data, null, 2).slice(0, 4000)}
          </Text>
        ) : (
          <Text className="mt-2 text-muted-foreground text-xs">
            No config loaded yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
