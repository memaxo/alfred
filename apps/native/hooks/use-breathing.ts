import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { EASING, DURATION } from "../theme/animation";
import { useReducedMotion } from "./use-void-theme";

interface UseBreathingOptions {
  active?: boolean;
  intensity?: "subtle" | "normal" | "strong";
  duration?: number;
}

export function useBreathing({
  active = true,
  intensity = "normal",
  duration = DURATION.breathe,
}: UseBreathingOptions = {}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const config = getIntensityConfig(intensity);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      return;
    }

    scale.value = withRepeat(
      withTiming(config.scale, {
        duration: duration / 2,
        easing: EASING.breathe,
      }),
      -1,
      true
    );

    opacity.value = withRepeat(
      withTiming(config.opacity, {
        duration: duration / 2,
        easing: EASING.breathe,
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, reduceMotion, duration, config.scale, config.opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return animatedStyle;
}

function getIntensityConfig(intensity: "subtle" | "normal" | "strong") {
  switch (intensity) {
    case "subtle": {
      return { scale: 1.01, opacity: 0.9 };
    }
    case "normal": {
      return { scale: 1.03, opacity: 0.85 };
    }
    case "strong": {
      return { scale: 1.05, opacity: 0.8 };
    }
  }
}

export default useBreathing;
