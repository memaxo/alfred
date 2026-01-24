import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { FlatList, StyleSheet, View, RefreshControl } from "react-native";

import {
  BiolumText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { EmptyState } from "@/components/utility/EmptyState";
import { useToast } from "@/contexts/toast";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TimersScreen() {
  const theme = useVoidTheme();
  const toast = useToast();

  // Use active endpoint - timers API uses 'active' not 'list'
  const {
    data: timers,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.timer.active.useQuery({});

  const doneMutation = trpc.timer.done.useMutation({
    onSuccess: () => refetch(),
    onError: (error: { message: string }) =>
      toast.error("Failed to complete timer", error.message),
  });

  const cancelMutation = trpc.timer.cancel.useMutation({
    onSuccess: () => refetch(),
    onError: (error: { message: string }) =>
      toast.error("Failed to cancel timer", error.message),
  });

  // Update running timers every second
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const renderItem = ({
    item,
  }: {
    item: NonNullable<typeof timers>[number];
  }) => {
    const now = new Date();
    const end = new Date(item.end);
    const start = new Date(item.start);
    const remaining = Math.max(
      0,
      Math.floor((end.getTime() - now.getTime()) / 1000)
    );
    const total = item.duration;
    const progress = total > 0 ? (remaining / total) * 100 : 0;
    const isComplete = remaining <= 0 || item.completed;

    return (
      <HUDSurface elevation={1} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.timerInfo}>
            <BiolumText variant="body" size="large" color="full">
              {item.label ?? "Timer"}
            </BiolumText>
            <TitleText size="large" color={isComplete ? "dim" : "bright"}>
              {formatTime(remaining)}
            </TitleText>
          </View>

          <View style={styles.actions}>
            {!isComplete && (
              <FluidButton
                icon={
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.semantic.success}
                  />
                }
                variant="ghost"
                size="small"
                onPress={() => doneMutation.mutate({ id: item.id })}
              />
            )}
            <FluidButton
              icon={
                <Ionicons
                  name="close"
                  size={20}
                  color={theme.colors.biolum.dim}
                />
              }
              variant="ghost"
              size="small"
              onPress={() => cancelMutation.mutate({ id: item.id })}
            />
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.colors.glass.surface },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: isComplete
                  ? theme.colors.semantic.success
                  : theme.colors.biolum.standard,
              },
            ]}
          />
        </View>

        <CaptionText size="small" color="faint" style={styles.duration}>
          Total: {formatTime(total)}
        </CaptionText>
      </HUDSurface>
    );
  };

  if (!isLoading && (!timers || timers.length === 0)) {
    return (
      <VoidContainer gradient="ambient" noise={true} style={styles.container}>
        <EmptyState
          icon="timer-outline"
          title="No active timers"
          message="Your timers will appear here"
          actionLabel="Create Timer"
          onAction={() =>
            toast.info("Coming soon", "Timer creation will be available soon")
          }
        />
      </VoidContainer>
    );
  }

  return (
    <VoidContainer gradient="ambient" noise={true} style={styles.container}>
      <FlatList
        data={timers ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        extraData={tick}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.biolum.standard}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
      />

      <FluidButton
        icon={
          <Ionicons name="add" size={24} color={theme.colors.biolum.full} />
        }
        variant="primary"
        size="large"
        onPress={() =>
          toast.info("Coming soon", "Timer creation will be available soon")
        }
        style={styles.fab}
      />
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  timerInfo: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  duration: {
    marginTop: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
