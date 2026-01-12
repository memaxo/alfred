"use client";

import { useMemo } from "react";
import { useDesktopStore } from "@/store/desktop";

/**
 * Hook to calculate focus gravity effects for a window.
 * Returns opacity and blur values based on whether the window is focused.
 */
export function useFocusGravity(_windowId: string, isFocused: boolean) {
  const focusedWindowId = useDesktopStore((s) => s.focusedWindowId);

  // Calculate gravity effect
  // If nothing is focused, everyone is 100% opacity.
  // If something else is focused, we dim and slightly blur.
  const effects = useMemo(() => {
    if (!focusedWindowId || isFocused) {
      return {
        opacity: 1,
        blur: 0,
        scale: 1,
      };
    }

    return {
      opacity: 0.6,
      blur: 2,
      scale: 0.98,
    };
  }, [focusedWindowId, isFocused]);

  return effects;
}
