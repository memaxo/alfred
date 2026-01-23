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

function clamp01(n: number): number {
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}

export function PolicyWindow(_props: WindowComponentProps) {
  const utils = trpc.useUtils();
  const query = trpc.cognitive.autonomyGet.useQuery();
  const mutate = trpc.cognitive.autonomySet.useMutation({
    onSuccess: async () => {
      await utils.cognitive.autonomyGet.invalidate();
    },
  });

  const scopes = useMemo(() => (query.data as any)?.scopes ?? [], [query.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Policy</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Autonomy controls per scope.
        </Text>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Autonomy</Text>
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
          <View className="mt-3 gap-2">
            {scopes.map((s: any) => {
              const scope = String(s.scope);
              const level = typeof s.level === "number" ? s.level : 0.5;
              const desc = String(s.description ?? "");
              const nextDown = clamp01(level - 0.1);
              const nextUp = clamp01(level + 0.1);
              return (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={scope}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {scope}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {desc}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    level: {level.toFixed(2)}
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      disabled={mutate.isPending}
                      onPress={() =>
                        mutate.mutate({ scope: scope as any, level: nextDown })
                      }
                    >
                      <Text className="text-secondary-foreground text-xs">
                        -0.1
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      disabled={mutate.isPending}
                      onPress={() =>
                        mutate.mutate({ scope: scope as any, level: nextUp })
                      }
                    >
                      <Text className="text-secondary-foreground text-xs">
                        +0.1
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
