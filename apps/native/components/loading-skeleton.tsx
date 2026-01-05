/**
 * Loading Skeleton Components
 *
 * Provides skeleton screens for better loading UX.
 */

import { useEffect } from "react";
import { type DimensionValue, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

function SkeletonShimmer() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="absolute inset-0 bg-muted"
      style={animatedStyle}
    />
  );
}

export function SkeletonLine({
  width = "100%",
  height = 16,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  return (
    <View
      className="relative overflow-hidden rounded"
      style={{ width, height }}
    >
      <View className="h-full w-full bg-muted" />
      <SkeletonShimmer />
    </View>
  );
}

export function SkeletonBox({
  width = "100%",
  height = 100,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  return (
    <View
      className="relative overflow-hidden rounded-lg"
      style={{ width, height }}
    >
      <View className="h-full w-full bg-muted" />
      <SkeletonShimmer />
    </View>
  );
}

export function NoteSkeleton() {
  return (
    <View className="mb-3 rounded-lg border border-border bg-card p-4">
      <SkeletonLine height={20} width="60%" />
      <View className="mt-2" />
      <SkeletonLine height={14} width="100%" />
      <View className="mt-1" />
      <SkeletonLine height={14} width="80%" />
      <View className="mt-3 flex-row gap-2">
        <SkeletonBox height={24} width={60} />
        <SkeletonBox height={24} width={60} />
      </View>
    </View>
  );
}

export function ReminderSkeleton() {
  return (
    <View className="mb-3 rounded-lg border border-border bg-card p-4">
      <SkeletonLine height={20} width="70%" />
      <View className="mt-2" />
      <SkeletonLine height={14} width="100%" />
      <View className="mt-3 flex-row gap-4">
        <SkeletonLine height={12} width={80} />
        <SkeletonLine height={12} width={60} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <NoteSkeleton key={i} />
      ))}
    </>
  );
}
