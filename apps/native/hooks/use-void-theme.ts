import { useMemo } from "react";
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import {
  VOID_PALETTE,
  ATTENTION_SCALE,
  GLOW,
  TYPOGRAPHY,
  SPACING,
  RADII,
  TOUCH_TARGETS,
  EASING,
  DURATION,
  SPRING_CONFIG,
} from "../theme";

export function useVoidTheme() {
  return useMemo(
    () => ({
      colors: VOID_PALETTE,
      attention: ATTENTION_SCALE,
      glow: GLOW,
      typography: TYPOGRAPHY,
      spacing: SPACING,
      radii: RADII,
      touchTargets: TOUCH_TARGETS,
      animation: {
        easing: EASING,
        duration: DURATION,
        spring: SPRING_CONFIG,
      },
    }),
    []
  );
}

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export function useColorScheme() {
  // ALFRED always uses dark mode (void aesthetic)
  return "dark" as const;
}
