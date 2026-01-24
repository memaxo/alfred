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

export function AgentfsWindow({ window: _window }: WindowComponentProps) {
  const [selected, setSelected] = useState<{
    runId: string;
    dbPath: string;
  } | null>(null);

  const wsQuery = trpc.agentfs.workspacesList.useQuery(undefined, {
    retry: false,
  });
  const opsQuery = trpc.agentfs.operationsList.useQuery(
    {
      runId: selected?.runId ?? "missing",
      dbPath: selected?.dbPath ?? "missing",
      limit: 100,
    },
    { enabled: selected !== null, retry: false }
  );

  const workspaces = useMemo(
    () => (wsQuery.data as any)?.workspaces ?? [],
    [wsQuery.data]
  );
  const operations = useMemo(
    () => (opsQuery.data as any)?.operations ?? [],
    [opsQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              AgentFS
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Browse AgentFS workspaces (.agentfs/*) and recent operations.
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={wsQuery.isFetching}
            onPress={() => void wsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Workspaces</Text>
        {wsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : wsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {wsQuery.error.message}
          </Text>
        ) : workspaces.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No AgentFS runs found.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {workspaces.slice(0, 20).map((w: any) => {
              const runId = String(w.runId ?? w.id);
              const dbPath = String(w.dbPath ?? "");
              const isSelected = selected?.runId === runId;
              return (
                <TouchableOpacity
                  className={[
                    "rounded-md border p-3",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  ].join(" ")}
                  key={runId}
                  onPress={() => setSelected({ runId, dbPath })}
                >
                  <Text className="font-medium text-foreground text-sm">
                    {runId}
                  </Text>
                  <Text className="mt-1 text-muted-foreground text-xs">
                    {String(w.status ?? "")} • {String(w.agentType ?? "")}
                  </Text>
                  <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {dbPath}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">
            Operations
          </Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={!selected || opsQuery.isFetching}
            onPress={() => void opsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>

        {selected === null ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            Select a workspace above.
          </Text>
        ) : opsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : opsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {opsQuery.error.message}
          </Text>
        ) : operations.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No operations found.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {operations.slice(0, 30).map((op: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(op.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(op.type ?? op.name ?? "op")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(op.timestamp ?? "")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(op.path ?? "")}
                </Text>
                {op.error ? (
                  <Text className="mt-1 text-destructive text-xs">
                    {String(op.error)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
