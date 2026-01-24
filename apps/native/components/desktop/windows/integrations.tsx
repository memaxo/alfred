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

export function IntegrationsWindow(_props: WindowComponentProps) {
  const query = trpc.integration.list.useQuery();
  const test = trpc.integration.testConnection.useMutation();
  const [last, setLast] = useState<string | null>(null);

  const rows = useMemo(() => query.data ?? [], [query.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">
          Integrations
        </Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          External service connectivity checks.
        </Text>
        <TouchableOpacity
          className="mt-3 self-start rounded-md bg-secondary px-3 py-2"
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        >
          <Text className="text-secondary-foreground text-xs">Refresh</Text>
        </TouchableOpacity>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Status</Text>
        {query.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : query.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {query.error.message}
          </Text>
        ) : rows.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No integrations defined.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {rows.map((r) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={r.id}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="font-medium text-foreground text-sm">
                      {r.name}
                    </Text>
                    <Text className="mt-1 text-muted-foreground text-xs">
                      enabled: {String(r.enabled)} • connected:{" "}
                      {String(r.connected)}
                    </Text>
                    {r.error ? (
                      <Text className="mt-1 text-destructive text-xs">
                        {r.error}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    className="rounded-md bg-secondary px-3 py-2"
                    disabled={test.isPending}
                    onPress={() =>
                      test.mutate(
                        { id: r.id },
                        {
                          onSuccess: (data) => {
                            setLast(
                              `${r.id}: ${String((data as any).message ?? "")}`
                            );
                          },
                        }
                      )
                    }
                  >
                    <Text className="text-secondary-foreground text-xs">
                      Test
                    </Text>
                  </TouchableOpacity>
                </View>
                {r.details ? (
                  <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(r.details, null, 2).slice(0, 800)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Last test</Text>
        <Text className="mt-2 text-muted-foreground text-xs">
          {last ?? "None"}
        </Text>
      </View>
    </ScrollView>
  );
}
