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

export function AdminWindow({ window: _window }: WindowComponentProps) {
  const utils = trpc.useUtils();
  const [logTarget, setLogTarget] = useState<"alfred" | "voice" | "embed">(
    "alfred"
  );
  const statusQuery = trpc.runtime.status.useQuery();
  const logsQuery = trpc.runtime.logs.useQuery(
    { component: logTarget, tail: 200 },
    { retry: false }
  );
  const recover = trpc.runtime.recover.useMutation({
    onSuccess: async () => {
      await utils.runtime.status.invalidate();
    },
  });

  const statusText = useMemo(() => {
    try {
      return JSON.stringify(statusQuery.data ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, [statusQuery.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Admin</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Runtime status, recovery actions, and log tail.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Runtime</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => {
              void statusQuery.refetch();
              void logsQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {statusQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : statusQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {statusQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {statusText.slice(0, 2500)}
          </Text>
        )}

        <View className="mt-3 flex-row flex-wrap gap-2">
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={recover.isPending}
            onPress={() => recover.mutate({ component: "voice" })}
          >
            <Text className="text-secondary-foreground text-xs">
              Recover voice
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={recover.isPending}
            onPress={() => recover.mutate({ component: "embed" })}
          >
            <Text className="text-secondary-foreground text-xs">
              Recover embed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={recover.isPending}
            onPress={() => recover.mutate({ component: "all" })}
          >
            <Text className="text-secondary-foreground text-xs">
              Recover all
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Logs</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["alfred", "voice", "embed"] as const).map((c) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                c === logTarget
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={c}
              onPress={() => setLogTarget(c)}
            >
              <Text className="text-foreground text-xs">{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {logsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : logsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {logsQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
            {String((logsQuery.data as any)?.logs ?? "").slice(0, 6000)}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
