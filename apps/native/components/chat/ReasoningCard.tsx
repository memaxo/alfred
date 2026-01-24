import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, MonoText } from "../foundation/BiolumText";

interface ReasoningCardProps {
  text: string;
  state?: "thinking" | "complete";
  defaultExpanded?: boolean;
}

export function ReasoningCard({
  text,
  state = "complete",
  defaultExpanded = false,
}: ReasoningCardProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(expanded ? 1 : 0);
  const height = useSharedValue(expanded ? 1 : 0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (state === "thinking" && !reduceMotion) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [state, reduceMotion]);

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    rotation.value = withTiming(newExpanded ? 1 : 0, {
      duration: theme.animation.duration.fast,
    });
    height.value = withTiming(newExpanded ? 1 : 0, {
      duration: theme.animation.duration.normal,
    });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(rotation.value, [0, 1], [0, 90])}deg` },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: height.value,
    maxHeight: interpolate(height.value, [0, 1], [0, 500], Extrapolation.CLAMP),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.glass.surface,
          borderLeftColor: theme.colors.biolum.faint,
        },
      ]}
      accessibilityLabel="Assistant reasoning"
    >
      <Pressable
        onPress={toggleExpanded}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Animated.View style={iconStyle}>
            <View style={styles.iconContainer}>
              {state === "thinking" ? (
                <ThinkingIcon color={theme.colors.biolum.dim} />
              ) : (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.semantic.success}
                />
              )}
            </View>
          </Animated.View>
          <BiolumText variant="caption" size="large" color="dim">
            {state === "thinking" ? "Thinking..." : "Reasoning"}
          </BiolumText>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.biolum.faint}
          />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.content, contentStyle]}>
        <MonoText size="medium" color="faint" selectable>
          {text}
        </MonoText>
      </Animated.View>
    </View>
  );
}

function ThinkingIcon({ color }: { color: string }) {
  return (
    <View style={styles.thinkingIcon}>
      <View
        style={[styles.circle, styles.circleOuter, { borderColor: color }]}
      />
      <View
        style={[styles.circle, styles.circleMiddle, { borderColor: color }]}
      />
      <View
        style={[styles.circle, styles.circleInner, { borderColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderLeftWidth: 2,
    borderRadius: 8,
    padding: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginTop: 8,
    overflow: "hidden",
  },
  thinkingIcon: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 100,
  },
  circleOuter: {
    width: 14,
    height: 14,
    opacity: 0.3,
  },
  circleMiddle: {
    width: 10,
    height: 10,
    opacity: 0.5,
  },
  circleInner: {
    width: 6,
    height: 6,
    opacity: 0.8,
  },
});

export default ReasoningCard;
