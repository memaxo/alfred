import { useStore } from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import { useMindscapeStore } from "@/store/mindscape";

export type LODLevel = "tiny" | "small" | "medium" | "full";

// Zoom thresholds
const THRESHOLD_SMALL = 0.4;
const THRESHOLD_MEDIUM = 0.8;
const THRESHOLD_FULL = 1.5;

/**
 * React hook that returns the current Level of Detail (LOD)
 * based on the React Flow viewport zoom level.
 *
 * It uses a selector to ensure components only re-render when the
 * discrete LOD level changes, not on every zoom tick.
 */
export function useLOD(): LODLevel {
  return useStore((state) => {
    const zoom = state.transform[2];

    if (zoom < THRESHOLD_SMALL) {
      return "tiny";
    }
    if (zoom < THRESHOLD_MEDIUM) {
      return "small";
    }
    if (zoom < THRESHOLD_FULL) {
      return "medium";
    }
    return "full";
  });
}

/**
 * Helper to check if a specific detail level should be visible
 */
export function useLODVisible(minLevel: LODLevel): boolean {
  const currentLOD = useLOD();
  const levels = ["tiny", "small", "medium", "full"];
  return levels.indexOf(currentLOD) >= levels.indexOf(minLevel);
}

/**
 * Hook to check if a node is focused or dimmed.
 */
export function useNodeFocus(nodeId: string) {
  return useMindscapeStore(
    useShallow((state) => {
      const focusedId = state.focusedNodeId;
      const isFocused = focusedId === nodeId;
      const isDimmed = focusedId !== null && !isFocused;
      return { isFocused, isDimmed };
    })
  );
}
