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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function WorkWindow({ window }: WindowComponentProps) {
  const runId = asString((window.data as Record<string, unknown>).runId);

  const compilationQuery = trpc.workflow.compilation.get.useQuery(
    { runId: runId ?? "missing" },
    { enabled: runId !== null }
  );

  const compilation = compilationQuery.data as any;

  if (!runId) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="font-semibold text-foreground">Work Compilation</Text>
        <Text className="mt-2 text-center text-muted-foreground text-xs">
          No workflow run selected.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              Work Compilation
            </Text>
            <Text className="mt-1 font-mono text-muted-foreground text-xs">
              {runId.slice(-12)}
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            disabled={compilationQuery.isFetching}
            onPress={() => void compilationQuery.refetch()}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {compilationQuery.isLoading ? (
        <View className="py-8">
          <ActivityIndicator color="#00D9FF" />
        </View>
      ) : compilationQuery.error ? (
        <View className="rounded-lg border border-destructive/30 bg-card p-4">
          <Text className="text-destructive text-sm">
            {compilationQuery.error.message}
          </Text>
        </View>
      ) : !compilation ? (
        <View className="rounded-lg border border-border bg-card p-4">
          <Text className="text-center text-muted-foreground">
            No compilation data available.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary */}
          {compilation.summaryText && (
            <View className="mb-4 rounded-lg border border-border bg-card p-4">
              <Text className="font-medium text-foreground text-sm">
                Summary
              </Text>
              <Text className="mt-2 text-muted-foreground text-sm">
                {compilation.summaryText}
              </Text>
            </View>
          )}

          {/* Artifacts */}
          {compilation.artifacts && compilation.artifacts.length > 0 && (
            <View className="mb-4 rounded-lg border border-border bg-card p-4">
              <Text className="font-medium text-foreground text-sm">
                Artifacts ({compilation.artifacts.length})
              </Text>
              <View className="mt-3 gap-2">
                {compilation.artifacts.map((artifact: any, idx: number) => (
                  <View
                    className="rounded-md border border-border bg-background p-3"
                    key={artifact.path ?? idx}
                  >
                    <Text className="font-mono text-foreground text-xs">
                      {artifact.path ?? `artifact-${idx}`}
                    </Text>
                    {artifact.type && (
                      <Text className="mt-1 text-muted-foreground text-xs">
                        Type: {artifact.type}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Raw Data */}
          <View className="rounded-lg border border-border bg-card p-4">
            <Text className="font-medium text-foreground text-sm">
              Raw Data
            </Text>
            <Text
              className="mt-2 font-mono text-muted-foreground text-xs"
              numberOfLines={20}
            >
              {JSON.stringify(compilation, null, 2)}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
