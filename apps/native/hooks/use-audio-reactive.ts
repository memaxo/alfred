import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { useReducedMotion } from "./use-void-theme";

interface UseAudioReactiveOptions {
  audioLevel: number; // 0-1
  minScale?: number;
  maxScale?: number;
  responsiveness?: number; // ms
}

export function useAudioReactive({
  audioLevel,
  minScale = 1,
  maxScale = 1.15,
  responsiveness = 100,
}: UseAudioReactiveOptions) {
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      level.value = 0;
      return;
    }

    level.value = withTiming(audioLevel, { duration: responsiveness });
  }, [audioLevel, reduceMotion, responsiveness]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(level.value, [0, 1], [minScale, maxScale]);
    return {
      transform: [{ scale }],
    };
  });

  return animatedStyle;
}

export default useAudioReactive;
