import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

interface CacheHandoffBadgeProps {
  visible?: boolean;
  label?: string;
}

export function CacheHandoffBadge({
  visible = true,
  label = "Cache hit",
}: CacheHandoffBadgeProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: theme.animation.duration.normal,
      });
      if (!reduceMotion) {
        glowOpacity.value = withSequence(
          withTiming(0.3, { duration: 500 }),
          withTiming(0.1, { duration: 1000 })
        );
      }
    } else {
      opacity.value = withTiming(0, {
        duration: theme.animation.duration.fast,
      });
    }
  }, [visible, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.glass.surface,
          borderColor: theme.colors.glass.border,
        },
        containerStyle,
        glowStyle,
        {
          shadowColor: theme.colors.semantic.success,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 8,
          elevation: 1,
        },
      ]}
      accessibilityLabel={label}
    >
      <Ionicons name="flash" size={12} color={theme.colors.semantic.success} />
      <BiolumText variant="caption" size="small" color="dim">
        {label}
      </BiolumText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});

export default CacheHandoffBadge;
