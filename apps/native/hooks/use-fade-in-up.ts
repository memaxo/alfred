import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { EASING, DURATION } from "../theme/animation";
import { useReducedMotion } from "./use-void-theme";

interface UseFadeInUpOptions {
  delay?: number;
  duration?: number;
  distance?: number;
}

export function useFadeInUp({
  delay = 0,
  duration = DURATION.normal,
  distance = 20,
}: UseFadeInUpOptions = {}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: EASING.enter,
      })
    );

    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration,
        easing: EASING.enter,
      })
    );
  }, [delay, duration, distance, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}

export default useFadeInUp;
