import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { useVoidTheme } from "@/hooks/use-void-theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const theme = useVoidTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.5, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: theme.colors.void.surface,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

interface LoadingSkeletonProps {
  variant?: "list" | "card" | "chat" | "detail";
  count?: number;
}

export function LoadingSkeleton({
  variant = "list",
  count = 3,
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  switch (variant) {
    case "chat": {
      return (
        <View style={styles.container}>
          {items.map((i) => (
            <View
              key={i}
              style={[
                styles.chatBubble,
                i % 2 === 0 ? styles.chatLeft : styles.chatRight,
              ]}
            >
              <Skeleton
                width={i % 2 === 0 ? "70%" : "60%"}
                height={60}
                borderRadius={16}
              />
            </View>
          ))}
        </View>
      );
    }

    case "card": {
      return (
        <View style={styles.container}>
          {items.map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton height={120} borderRadius={12} />
              <View style={styles.cardContent}>
                <Skeleton width="80%" height={20} />
                <Skeleton width="60%" height={14} style={styles.mt8} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    case "detail": {
      return (
        <View style={styles.container}>
          <Skeleton height={200} borderRadius={12} />
          <View style={styles.detailContent}>
            <Skeleton width="90%" height={24} />
            <Skeleton width="70%" height={16} style={styles.mt12} />
            <Skeleton width="100%" height={80} style={styles.mt16} />
            <Skeleton width="50%" height={16} style={styles.mt12} />
          </View>
        </View>
      );
    }

    case "list":
    default: {
      return (
        <View style={styles.container}>
          {items.map((i) => (
            <View key={i} style={styles.listItem}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={styles.listContent}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="50%" height={12} style={styles.mt8} />
              </View>
            </View>
          ))}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listContent: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  cardContent: {
    padding: 12,
  },
  detailContent: {
    padding: 16,
  },
  chatBubble: {
    marginVertical: 4,
  },
  chatLeft: {
    alignItems: "flex-start",
  },
  chatRight: {
    alignItems: "flex-end",
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  mt16: {
    marginTop: 16,
  },
});
