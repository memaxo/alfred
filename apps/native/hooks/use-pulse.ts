import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { EASING, DURATION } from "../theme/animation";
import { useReducedMotion } from "./use-void-theme";

interface UsePulseOptions {
  active?: boolean;
  duration?: number;
  minScale?: number;
  maxScale?: number;
}

export function usePulse({
  active = true,
  duration = DURATION.pulse,
  minScale = 1,
  maxScale = 1.1,
}: UsePulseOptions = {}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      return;
    }

    scale.value = withRepeat(
      withSequence(
        withTiming(maxScale, {
          duration: duration / 2,
          easing: EASING.standard,
        }),
        withTiming(minScale, {
          duration: duration / 2,
          easing: EASING.standard,
        })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: duration / 2,
          easing: EASING.standard,
        }),
        withTiming(0.5, {
          duration: duration / 2,
          easing: EASING.standard,
        })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, reduceMotion, duration, minScale, maxScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return animatedStyle;
}

export default usePulse;
