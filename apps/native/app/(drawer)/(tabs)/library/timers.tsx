/**
 * Timers List Screen
 *
 * Displays active timers and allows creating new ones.
 * Styled with ALFRED's "Signal in the Void" design system.
 */

import { logger } from "@alfred/logger";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import type { TimerRouterOutputs } from "@/utils/trpc-types";

import {
  BodyText,
  CaptionText,
  FluidButton,
  HUDSurface,
  VoidContainer,
} from "@/components/foundation";
import { useTimerNotifications } from "@/hooks/use-timer-notifications";
import {
  useTimerActive,
  useTimerCancel,
  useTimerCreate,
  useTimerDone,
} from "@/hooks/use-trpc";
import { useReducedMotion, useVoidTheme } from "@/hooks/use-void-theme";
import { haptics } from "@/lib/haptics";

type TimerItem = TimerRouterOutputs["active"][number];

export default function TimersListScreen() {
  const _router = useRouter();
  const theme = useVoidTheme();
  const [duration, setDuration] = useState("");
  const [label, setLabel] = useState("");

  const timersQuery = useTimerActive();
  useTimerNotifications(timersQuery.data ?? []);

  // Refetch every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      timersQuery.refetch();
    }, 1000);
    return () => clearInterval(interval);
  }, [timersQuery]);

  const createMutation = useTimerCreate();
  const doneMutation = useTimerDone();
  const cancelMutation = useTimerCancel();

  useEffect(() => {
    if (createMutation.isSuccess) {
      timersQuery.refetch();
      setDuration("");
      setLabel("");
    }
  }, [createMutation.isSuccess, timersQuery]);

  useEffect(() => {
    if (doneMutation.isSuccess || cancelMutation.isSuccess) {
      timersQuery.refetch();
    }
  }, [doneMutation.isSuccess, cancelMutation.isSuccess, timersQuery]);

  const handleCreate = useCallback(() => {
    const seconds = Number.parseInt(duration, 10);
    if (Number.isNaN(seconds) || seconds <= 0) {
      haptics.error();
      Alert.alert("Invalid Duration", "Please enter a valid number of seconds");
      return;
    }
    haptics.success();
    createMutation.mutate({
      duration: seconds,
      label: label.trim() || undefined,
    });
  }, [duration, label, createMutation]);

  const handleDone = useCallback(
    (timerId: string) => {
      haptics.success();
      doneMutation.mutate({ id: timerId });
    },
    [doneMutation]
  );

  const handleCancel = useCallback(
    (timerId: string) => {
      haptics.light();
      cancelMutation.mutate({ id: timerId });
    },
    [cancelMutation]
  );

  const formatTimeRemaining = useCallback((timer: TimerItem) => {
    const now = Date.now();
    // Use end field from database exclusively - it accounts for paused/resumed timers and clock skew
    if (!timer.end) {
      logger.error("Timer missing end field", {
        timerId: timer.id,
        hasStart: !!timer.start,
        duration: timer.duration,
      });
      // Return 0:00 as fallback to prevent UI crash
      return "0:00";
    }
    const endTime = new Date(timer.end).getTime();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const renderTimerItem = useCallback(
    ({ item }: { item: TimerItem }) => (
      <MemoizedTimerItem
        item={item}
        formatTimeRemaining={formatTimeRemaining}
        onDone={handleDone}
        onCancel={handleCancel}
      />
    ),
    [formatTimeRemaining, handleDone, handleCancel]
  );

  return (
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <Stack.Screen
        options={{
          title: "Timers",
          headerStyle: { backgroundColor: theme.colors.void.deep },
          headerTintColor: theme.colors.biolum.bright,
        }}
      />

      <View style={styles.content}>
        {/* Create timer form */}
        <View style={styles.createForm}>
          <BodyText color="bright" style={styles.formTitle}>
            New Timer
          </BodyText>
          <HUDSurface elevation={1} style={styles.formContainer}>
            <View style={styles.inputsRow}>
              <TextInput
                accessibilityLabel="Timer duration in seconds"
                accessibilityRole="text"
                style={[
                  styles.durationInput,
                  { color: theme.colors.biolum.bright },
                ]}
                keyboardType="numeric"
                onChangeText={setDuration}
                placeholder="Duration (seconds)"
                placeholderTextColor={theme.colors.biolum.faint}
                value={duration}
              />
              <TextInput
                accessibilityLabel="Timer label"
                accessibilityRole="text"
                style={[
                  styles.labelInput,
                  { color: theme.colors.biolum.bright },
                ]}
                onChangeText={setLabel}
                placeholder="Label (optional)"
                placeholderTextColor={theme.colors.biolum.faint}
                value={label}
              />
            </View>
            <FluidButton
              onPress={handleCreate}
              disabled={createMutation.isPending || !duration}
              loading={createMutation.isPending}
              variant="primary"
              size="medium"
              accessibilityLabel="Start timer"
              icon={
                createMutation.isPending ? (
                  <ActivityIndicator
                    color={theme.colors.biolum.full}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    color={theme.colors.biolum.full}
                    name="play"
                    size={20}
                  />
                )
              }
              label="Start"
              style={styles.startButton}
            />
          </HUDSurface>
        </View>

        {/* Active timers list */}
        {timersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              color={theme.colors.semantic.warning}
              size="large"
            />
          </View>
        ) : (timersQuery.data && timersQuery.data.length > 0 ? (
          <FlashList
            contentContainerStyle={styles.listContent}
            data={timersQuery.data}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={90}
            refreshControl={
              <RefreshControl
                onRefresh={() => timersQuery.refetch()}
                refreshing={timersQuery.isRefetching}
                tintColor={theme.colors.semantic.warning}
              />
            }
            renderItem={renderTimerItem}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              color={theme.colors.biolum.faint}
              name="timer-outline"
              size={48}
            />
            <BodyText color="dim" style={styles.emptyText}>
              No active timers. Create one above!
            </BodyText>
          </View>
        ))}
      </View>
    </VoidContainer>
  );
}

interface TimerItemProps {
  item: TimerItem;
  formatTimeRemaining: (timer: TimerItem) => string;
  onDone: (id: string) => void;
  onCancel: (id: string) => void;
}

function TimerItem({
  item,
  formatTimeRemaining,
  onDone,
  onCancel,
}: TimerItemProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const glowOpacity = useSharedValue(0.4);

  // Breathing glow animation for active timers
  useEffect(() => {
    if (!reduceMotion) {
      glowOpacity.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      glowOpacity.value = 0.4;
    }
  }, [reduceMotion]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value * 0.6,
  }));

  const timeRemaining = formatTimeRemaining(item);
  const isExpired = timeRemaining === "0:00";

  // Calculate progress (0 to 1)
  const getProgress = () => {
    if (!item.end || !item.start) {
      return 0;
    }
    const now = Date.now();
    const start = new Date(item.start).getTime();
    const end = new Date(item.end).getTime();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(1, Math.max(0, elapsed / total));
  };

  const progress = getProgress();

  return (
    <Animated.View
      style={[
        styles.timerCardWrapper,
        {
          shadowColor: theme.colors.accent.cyan,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
        },
        !isExpired && animatedGlowStyle,
      ]}
    >
      <HUDSurface elevation={2} glow={!isExpired} style={styles.timerCard}>
        <View style={styles.timerContent}>
          {/* Circular progress indicator */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressRing,
                {
                  borderColor: theme.colors.glass.border,
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    borderColor: isExpired
                      ? theme.colors.semantic.success
                      : theme.colors.accent.cyan,
                    borderTopColor: "transparent",
                    borderRightColor: "transparent",
                    transform: [{ rotate: `${progress * 360}deg` }],
                  },
                ]}
              />
            </View>
            <Ionicons
              color={
                isExpired
                  ? theme.colors.semantic.success
                  : theme.colors.accent.cyan
              }
              name={isExpired ? "checkmark" : "timer-outline"}
              size={20}
              style={styles.progressIcon}
            />
          </View>

          {/* Timer info */}
          <View style={styles.timerInfo}>
            <BodyText
              accessibilityRole="header"
              color="bright"
              style={styles.timerLabel}
            >
              {item.label || "Timer"}
            </BodyText>
            <View
              accessibilityLabel={`Time remaining: ${timeRemaining}`}
              style={styles.timeDisplay}
            >
              <CaptionText
                mono
                color={isExpired ? "standard" : "bright"}
                style={styles.timeText}
              >
                {timeRemaining}
              </CaptionText>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.timerActions}>
            <Pressable
              accessibilityLabel="Mark timer as done"
              accessibilityRole="button"
              onPress={() => onDone(item.id)}
              hitSlop={8}
            >
              {({ pressed }) => (
                <Ionicons
                  color={theme.colors.semantic.success}
                  name="checkmark-circle"
                  size={28}
                  style={pressed ? styles.pressed : undefined}
                />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Cancel timer"
              accessibilityRole="button"
              onPress={() => onCancel(item.id)}
              hitSlop={8}
            >
              {({ pressed }) => (
                <Ionicons
                  color={theme.colors.semantic.error}
                  name="close-circle"
                  size={28}
                  style={pressed ? styles.pressed : undefined}
                />
              )}
            </Pressable>
          </View>
        </View>
      </HUDSurface>
    </Animated.View>
  );
}

const MemoizedTimerItem = memo(
  TimerItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.formatTimeRemaining === next.formatTimeRemaining &&
    prev.onDone === next.onDone &&
    prev.onCancel === next.onCancel
);

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  createForm: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  formTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  formContainer: {
    padding: 16,
    gap: 12,
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  durationInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  labelInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  startButton: {
    alignSelf: "flex-end",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
  },
  timerCardWrapper: {
    marginBottom: 12,
  },
  timerCard: {
    padding: 16,
  },
  timerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressContainer: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
  },
  progressFill: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
  },
  progressIcon: {
    position: "absolute",
  },
  timerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  timerLabel: {
    fontWeight: "600",
    marginBottom: 4,
  },
  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 20,
  },
  timerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
