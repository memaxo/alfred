import React from "react";
import { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useSharedValue,
  withSequence,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

interface GlowBorderProps {
  active?: boolean;
  pulsing?: boolean;
  color?: string;
  borderRadius?: number;
  borderWidth?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlowBorder({
  active = false,
  pulsing = false,
  color,
  borderRadius,
  borderWidth = 1,
  children,
  style,
}: GlowBorderProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const glowOpacity = useSharedValue(active ? 0.15 : 0.08);

  const effectiveColor = color ?? "rgba(255, 255, 255, 1)";
  const effectiveRadius = borderRadius ?? theme.radii.lg;

  useEffect(() => {
    if (pulsing && !reduceMotion) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1000 }),
          withTiming(0.08, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(active ? 0.15 : 0.08, { duration: 200 });
    }
  }, [pulsing, active, reduceMotion]);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 255, 255, ${glowOpacity.value})`,
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value * 0.5,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderRadius: effectiveRadius,
          borderWidth,
        },
        animatedBorderStyle,
        animatedGlowStyle,
        {
          shadowColor: effectiveColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 20,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default GlowBorder;
