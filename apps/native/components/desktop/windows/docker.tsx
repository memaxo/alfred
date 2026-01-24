import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

type Filter = "all" | "running" | "agent";

export function DockerWindow({ window: _window }: WindowComponentProps) {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = trpc.deploy.containersList.useQuery({ filter });
  const inspectQuery = trpc.deploy.containersInspect.useQuery(
    { containerId: selectedId ?? "missing" },
    { enabled: selectedId !== null, retry: false }
  );
  const logsQuery = trpc.deploy.containersLogs.useQuery(
    { containerId: selectedId ?? "missing", tail: 200 },
    { enabled: selectedId !== null, retry: false }
  );

  const start = trpc.deploy.containersStart.useMutation({
    onSuccess: async () => {
      await utils.deploy.containersList.invalidate();
    },
  });
  const stop = trpc.deploy.containersStop.useMutation({
    onSuccess: async () => {
      await utils.deploy.containersList.invalidate();
    },
  });
  const remove = trpc.deploy.containersRemove.useMutation({
    onSuccess: async () => {
      await utils.deploy.containersList.invalidate();
      setSelectedId(null);
    },
  });

  const containers = useMemo(
    () => (listQuery.data as any)?.containers ?? [],
    [listQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Docker</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          List and control containers.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["all", "running", "agent"] as const).map((f) => (
            <TouchableOpacity
              className={[
                "rounded-md border px-3 py-2",
                f === filter
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              ].join(" ")}
              key={f}
              onPress={() => {
                setSelectedId(null);
                setFilter(f);
              }}
            >
              <Text className="text-foreground text-xs">{f}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={listQuery.isFetching}
            onPress={() => void listQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Containers</Text>
        {listQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : listQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {listQuery.error.message}
          </Text>
        ) : containers.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No containers.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {containers.slice(0, 30).map((c: any) => {
              const id = String(c.id ?? "");
              const name = String(c.name ?? id);
              const status = String(c.status ?? "");
              const isSelected = selectedId === id;
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={id}
                  onPress={() => setSelectedId(id)}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {name}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {status} • {String(c.image ?? "")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Selected</Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={!selectedId}
            onPress={() => {
              void inspectQuery.refetch();
              void logsQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {selectedId === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select a container above.
          </Text>
        ) : (
          <>
            <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
              {selectedId}
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
              <TouchableOpacity
                className="rounded-md bg-secondary px-3 py-2"
                disabled={start.isPending}
                onPress={() => start.mutate({ containerId: selectedId })}
              >
                <Text className="text-secondary-foreground text-xs">Start</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-md bg-secondary px-3 py-2"
                disabled={stop.isPending}
                onPress={() => stop.mutate({ containerId: selectedId })}
              >
                <Text className="text-secondary-foreground text-xs">Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-md bg-destructive/10 px-3 py-2"
                disabled={remove.isPending}
                onPress={() =>
                  Alert.alert("Remove container", "Remove this container?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => remove.mutate({ containerId: selectedId }),
                    },
                  ])
                }
              >
                <Text className="text-destructive text-xs">Remove</Text>
              </TouchableOpacity>
            </View>

            {inspectQuery.error ? (
              <Text className="mt-2 text-destructive text-xs">
                inspect: {inspectQuery.error.message}
              </Text>
            ) : inspectQuery.isLoading ? (
              <View className="py-4">
                <ActivityIndicator color="#00D9FF" />
              </View>
            ) : inspectQuery.data ? (
              <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(inspectQuery.data, null, 2).slice(0, 3000)}
              </Text>
            ) : null}

            {logsQuery.error ? (
              <Text className="mt-2 text-destructive text-xs">
                logs: {logsQuery.error.message}
              </Text>
            ) : logsQuery.isLoading ? (
              <View className="py-4">
                <ActivityIndicator color="#00D9FF" />
              </View>
            ) : logsQuery.data ? (
              <Text className="mt-3 font-mono text-[10px] text-muted-foreground">
                {String((logsQuery.data as any).logs ?? "").slice(0, 4000)}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
