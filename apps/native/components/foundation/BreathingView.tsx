import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

interface BreathingViewProps {
  active?: boolean;
  intensity?: "subtle" | "normal" | "strong";
  duration?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function BreathingView({
  active = true,
  intensity = "normal",
  duration,
  children,
  style,
}: BreathingViewProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  const config = getIntensityConfig(intensity);
  const effectiveDuration = duration ?? theme.animation.duration.breathe;

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 1;
      opacity.value = 1;
      return;
    }

    scale.value = withRepeat(
      withTiming(config.scale, {
        duration: effectiveDuration / 2,
        easing: theme.animation.easing.breathe,
      }),
      -1,
      true
    );

    opacity.value = withRepeat(
      withTiming(config.opacity, {
        duration: effectiveDuration / 2,
        easing: theme.animation.easing.breathe,
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, reduceMotion, effectiveDuration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (reduceMotion || !active) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
  );
}

function getIntensityConfig(intensity: "subtle" | "normal" | "strong") {
  switch (intensity) {
    case "subtle":
      return { scale: 1.01, opacity: 0.8 };
    case "normal":
      return { scale: 1.03, opacity: 0.9 };
    case "strong":
      return { scale: 1.05, opacity: 1 };
  }
}

export default BreathingView;
