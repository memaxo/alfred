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

export function LearningWindow(_props: WindowComponentProps) {
  const feedbackQuery = trpc.cognitive.feedbackList.useQuery({ limit: 25 });
  const insightsQuery = trpc.cognitive.insightsList.useQuery();
  const accuracyQuery = trpc.cognitive.metricsAccuracy.useQuery();

  const feedback = useMemo(
    () => (feedbackQuery.data as any)?.mistakes ?? [],
    [feedbackQuery.data]
  );
  const insights = useMemo(
    () => (insightsQuery.data as any)?.insights ?? [],
    [insightsQuery.data]
  );
  const metrics = useMemo(
    () => (accuracyQuery.data as any)?.metrics ?? [],
    [accuracyQuery.data]
  );

  const isLoading =
    feedbackQuery.isLoading ||
    insightsQuery.isLoading ||
    accuracyQuery.isLoading;

  return (
    <ScrollView className="flex-1 px-3 py-3">
      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-foreground text-sm">
              Learning
            </Text>
            <Text className="mt-1 text-muted-foreground text-xs">
              Feedback, insights, and accuracy trends.
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-md bg-secondary px-3 py-2"
            onPress={() => {
              void feedbackQuery.refetch();
              void insightsQuery.refetch();
              void accuracyQuery.refetch();
            }}
          >
            <Text className="text-secondary-foreground text-xs">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="py-6">
          <ActivityIndicator color="#00D9FF" />
        </View>
      ) : null}

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Accuracy</Text>
        {accuracyQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {accuracyQuery.error.message}
          </Text>
        ) : metrics.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No metrics.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {metrics.slice(0, 10).map((m: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(m.category)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(m.category)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  errorRate: {String(m.errorRate)} • total: {String(m.total)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  trend: {String(m.trend)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="mb-4 rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Insights</Text>
        {insightsQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {insightsQuery.error.message}
          </Text>
        ) : insights.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No insights yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {insights.slice(0, 10).map((i: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(i.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(i.title)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(i.category)} • conf: {String(i.confidence)}
                </Text>
                <Text className="mt-2 text-muted-foreground text-xs">
                  {String(i.description)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="font-medium text-foreground text-sm">Feedback</Text>
        {feedbackQuery.error ? (
          <Text className="mt-2 text-destructive text-xs">
            {feedbackQuery.error.message}
          </Text>
        ) : feedback.length === 0 ? (
          <Text className="mt-2 text-muted-foreground text-xs">
            No feedback yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {feedback.slice(0, 10).map((f: any) => (
              <View
                className="rounded-md border border-border bg-background p-3"
                key={String(f.id)}
              >
                <Text className="font-medium text-foreground text-sm">
                  {String(f.category ?? "feedback")}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(f.expected ?? "").slice(0, 120)}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  {String(f.actual ?? "").slice(0, 120)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
