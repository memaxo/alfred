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

export function WorkflowlistWindow(_props: WindowComponentProps) {
  const openWindow = useDesktopStore((s) => s.openWindow);
  const utils = trpc.useUtils();
  const query = trpc.workflow.listRuns.useQuery({ limit: 25, offset: 0 });
  const cancel = trpc.workflow.cancel.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate();
    },
  });

  const runs = useMemo(() => query.data ?? [], [query.data]);

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Workflows</Text>
        <Text className="mt-1 text-muted-foreground text-xs">
          Recent workflow runs.
        </Text>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-foreground text-sm">Runs</Text>
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
        ) : (runs.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No workflow runs yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {runs.map((r: any) => {
              const id = String(r.id ?? r.runId ?? "");
              const status = String(r.status ?? "unknown");
              if (!id) {
                return null;
              }
              const canCancel = status === "running" || status === "suspended";
              return (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={id}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="font-medium text-foreground text-sm">
                        {status}
                      </Text>
                      <Text className="mt-1 text-[10px] text-muted-foreground">
                        {id}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="rounded-md bg-secondary px-3 py-2"
                        onPress={() =>
                          openWindow("workflow", {
                            label: `Workflow ${id.slice(0, 6)}`,
                            runId: id,
                          })
                        }
                      >
                        <Text className="text-secondary-foreground text-xs">
                          Open
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="rounded-md bg-destructive/10 px-3 py-2"
                        disabled={!canCancel || cancel.isPending}
                        onPress={() =>
                          Alert.alert(
                            "Cancel run",
                            "Cancel this workflow run?",
                            [
                              { text: "Keep", style: "cancel" },
                              {
                                text: "Cancel",
                                style: "destructive",
                                onPress: () => cancel.mutate({ runId: id }),
                              },
                            ]
                          )
                        }
                      >
                        <Text className="text-destructive text-xs">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
