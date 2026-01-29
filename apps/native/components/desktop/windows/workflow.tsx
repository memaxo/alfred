import { useMemo } from "react";
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function WorkflowWindow({ window }: WindowComponentProps) {
  const runId = asString((window.data as Record<string, unknown>).runId);
  const utils = trpc.useUtils();

  const statusQuery = trpc.workflow.phase.status.useQuery(
    { runId: runId ?? "missing" },
    { enabled: runId !== null }
  );
  const eventsQuery = trpc.workflow.events.useQuery(
    { runId: runId ?? "missing" },
    { enabled: runId !== null }
  );

  const cancel = trpc.workflow.cancel.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate();
      if (runId) {
        await utils.workflow.phase.status.invalidate({ runId });
        await utils.workflow.events.invalidate({ runId });
      }
    },
  });

  const status = statusQuery.data as any;
  const events = useMemo(
    () => (eventsQuery.data as any[]) ?? [],
    [eventsQuery.data]
  );

  if (!runId) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="font-semibold text-foreground">Workflow</Text>
        <Text className="mt-2 text-center text-muted-foreground text-xs">
          No run selected. Open a run from Workflow List.
        </Text>
      </View>
    );
  }

  const canCancel =
    status?.status === "running" || status?.status === "suspended";

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-semibold text-foreground text-sm">Workflow</Text>
        <Text className="mt-1 font-mono text-muted-foreground text-xs">
          {runId}
        </Text>

        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={statusQuery.isFetching || eventsQuery.isFetching}
            onPress={() => {
              void statusQuery.refetch();
              void eventsQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-md bg-destructive/10 px-3 py-2"
            disabled={!canCancel || cancel.isPending}
            onPress={() =>
              Alert.alert("Cancel run", "Cancel this workflow run?", [
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

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Status</Text>
        {statusQuery.isLoading ? (
          <View className="py-4">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : statusQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {statusQuery.error.message}
          </Text>
        ) : (
          <View className="mt-2 gap-1">
            <Text className="text-foreground text-sm">
              state: {String(status?.state ?? "unknown")}
            </Text>
            <Text className="text-muted-foreground text-xs">
              phase: {String(status?.phase ?? "unknown")}
            </Text>
            <Text className="text-muted-foreground text-xs">
              status: {String(status?.status ?? "unknown")}
            </Text>
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Events</Text>
        {eventsQuery.isLoading ? (
          <View className="py-4">
            <ActivityIndicator color="#00D9FF" />
          </View>
        ) : eventsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {eventsQuery.error.message}
          </Text>
        ) : events.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No events yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {events
              .slice(-50)
              .toReversed()
              .map((e, idx) => (
                <View
                  className="rounded-md border border-border bg-background p-3"
                  key={`${idx}_${String(e?.id ?? e?.ts ?? "")}`}
                >
                  <Text className="font-mono text-[10px] text-muted-foreground">
                    {String(e?.type ?? e?._ ?? "event")}
                  </Text>
                  <Text
                    className="mt-1 text-muted-foreground text-xs"
                    numberOfLines={4}
                  >
                    {JSON.stringify(e)}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
