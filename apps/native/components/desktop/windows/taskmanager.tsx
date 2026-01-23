import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { WindowComponentProps } from "./types";

export function TaskmanagerWindow({ window: _window }: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const utils = trpc.useUtils();

  const runsQuery = trpc.workflow.listRuns.useQuery({ limit: 50, offset: 0 });
  const runtimeQuery = trpc.runtime.status.useQuery();

  const cancel = trpc.workflow.cancel.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate();
    },
  });
  const suspend = trpc.workflow.suspend.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate();
    },
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const active = runs.filter((r: any) =>
    ["running", "suspended"].includes(String(r.status))
  );

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              Task Manager
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Active workflows + runtime status.
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => {
              void runsQuery.refetch();
              void runtimeQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Runtime</Text>
        {runtimeQuery.isLoading ? (
          <View className="py-4">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : runtimeQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {runtimeQuery.error.message}
          </Text>
        ) : (
          <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(runtimeQuery.data, null, 2).slice(0, 2000)}
          </Text>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">
          Active workflows
        </Text>
        {runsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : runsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {runsQuery.error.message}
          </Text>
        ) : active.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No active runs.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {active.slice(0, 25).map((r: any) => {
              const runId = String(r.id ?? r.runId ?? "");
              const status = String(r.status ?? "unknown");
              return (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={runId}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="font-medium text-foreground text-sm">
                        {status}
                      </Text>
                      <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {runId}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      onPress={() =>
                        openWindow("workflow", {
                          label: `Workflow ${runId.slice(0, 6)}`,
                          runId,
                        })
                      }
                    >
                      <Text className="text-secondary-foreground text-xs">
                        Open
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View className="mt-2 flex-row flex-wrap gap-2">
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      disabled={status !== "running" || suspend.isPending}
                      onPress={() => suspend.mutate({ runId })}
                    >
                      <Text className="text-secondary-foreground text-xs">
                        Suspend
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="rounded-md bg-secondary px-3 py-2"
                      disabled={status !== "suspended"}
                      onPress={() =>
                        openWindow("workflow", {
                          label: `Workflow ${runId.slice(0, 6)}`,
                          runId,
                        })
                      }
                    >
                      <Text className="text-secondary-foreground text-xs">
                        Inspect
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="rounded-md bg-destructive/10 px-3 py-2"
                      disabled={cancel.isPending}
                      onPress={() =>
                        Alert.alert("Cancel run", "Cancel this run?", [
                          { text: "Keep", style: "cancel" },
                          {
                            text: "Cancel",
                            style: "destructive",
                            onPress: () => cancel.mutate({ runId }),
                          },
                        ])
                      }
                    >
                      <Text className="text-destructive text-xs">Cancel</Text>
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
