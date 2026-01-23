/**
 * Hook for zoom-aware edge visibility.
 *
 * NOTE: Edge functionality has been deprecated in the new type system.
 * These hooks now return stub values for backward compatibility.
 */

import { useStore } from "@xyflow/react";
import { useMemo } from "react";
import { getEdgeVisibility } from "@/lib/desktop/performance";

type EdgeVisibility = {
  showEdges: boolean;
  showLabels: boolean;
  filterImportant: boolean;
};

/**
 * Get current edge visibility settings based on zoom.
 */
export function useEdgeVisibility(): EdgeVisibility {
  const zoom = useStore((state) => state.transform[2]);
  return useMemo(() => getEdgeVisibility(zoom), [zoom]);
}

/**
 * Check if edges should be visible at current zoom.
 */
export function useShowEdges(): boolean {
  const zoom = useStore((state) => state.transform[2]);
  return zoom >= 0.3;
}

/**
 * Check if edge labels should be visible at current zoom.
 */
export function useShowEdgeLabels(): boolean {
  const zoom = useStore((state) => state.transform[2]);
  return zoom >= 0.6;
}
