import type { ViewStyle } from "react-native";

import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

interface SignalDividerProps {
  animate?: boolean;
  color?: string;
  thickness?: number;
  style?: ViewStyle;
}

export function SignalDivider({
  animate = true,
  color,
  thickness = 1,
  style,
}: SignalDividerProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(animate && !reduceMotion ? 0 : 100);

  const effectiveColor = color ?? theme.colors.biolum.whisper;

  useEffect(() => {
    if (animate && !reduceMotion) {
      width.value = withTiming(100, {
        duration: theme.animation.duration.slow,
        easing: theme.animation.easing.enter,
      });
    }
  }, [animate, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Animated.View
      style={[
        styles.divider,
        {
          backgroundColor: effectiveColor,
          height: thickness,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    alignSelf: "center",
  },
});

export default SignalDivider;
