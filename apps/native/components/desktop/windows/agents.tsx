import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function AgentsWindow({ window: _window }: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const runsQuery = trpc.workflow.listRuns.useQuery({ limit: 25, offset: 0 });
  const sessionsQuery = trpc.codex.listSessions.useQuery({
    limit: 20,
    offset: 0,
  });
  const agentfsQuery = trpc.agentfs.workspacesList.useQuery(undefined, {
    retry: false,
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const sessions = useMemo(
    () => (sessionsQuery.data as any)?.sessions ?? [],
    [sessionsQuery.data]
  );
  const workspaces = useMemo(
    () => (agentfsQuery.data as any)?.workspaces ?? [],
    [agentfsQuery.data]
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Agents</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Workflow runs + Codex sessions + AgentFS runs.
        </Text>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">
            Workflow runs
          </Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => void runsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {runsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : runsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {runsQuery.error.message}
          </Text>
        ) : runs.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No runs yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {runs.slice(0, 10).map((r: any) => {
              const runId = String(r.id ?? r.runId ?? "");
              const status = String(r.status ?? "");
              return (
                <TouchableOpacity
                  className="rounded-md border border-border bg-background p-3"
                  key={runId}
                  onPress={() =>
                    openWindow("workflow", {
                      label: `Workflow ${runId.slice(0, 6)}`,
                      runId,
                    })
                  }
                >
                  <Text className="font-medium text-foreground text-sm">
                    {status || "run"}
                  </Text>
                  <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {runId}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">
            Codex sessions
          </Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => void sessionsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {sessionsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : sessionsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {sessionsQuery.error.message}
          </Text>
        ) : sessions.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No sessions.
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(sessions.slice(0, 10), null, 2).slice(0, 2500)}
          </Text>
        )}
        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-secondary px-3 py-2"
          onPress={() => openWindow("codex", { label: "Codex" })}
        >
          <Text className="text-secondary-foreground text-xs">Open Codex</Text>
        </TouchableOpacity>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">
            AgentFS runs
          </Text>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => void agentfsQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
        {agentfsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : agentfsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {agentfsQuery.error.message}
          </Text>
        ) : workspaces.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No AgentFS workspaces.
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(workspaces.slice(0, 5), null, 2).slice(0, 2000)}
          </Text>
        )}
        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-md bg-secondary px-3 py-2"
          onPress={() => openWindow("agentfs", { label: "AgentFS" })}
        >
          <Text className="text-secondary-foreground text-xs">
            Open AgentFS
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
