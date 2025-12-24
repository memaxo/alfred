/**
 * Hook for zoom-aware edge visibility.
 *
 * Implements edge degradation:
 * - zoom < 0.3: Hide all edges
 * - zoom 0.3-0.6: Show only important edges (blocks, depends_on, contains)
 * - zoom >= 0.6: Show all edges
 */

import { useStore } from "@xyflow/react";
import { useMemo } from "react";
import {
  filterEdgesByZoom,
  getEdgeVisibility,
} from "@/lib/desktop/performance";
import { useDesktopStore } from "@/store/desktop";
import {
  selectActiveEdges,
  selectEdges,
  selectHighlightedEdgeIds,
} from "@/store/desktop/selectors";

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
 * Get filtered edges based on current zoom level.
 */
export function useVisibleEdges() {
  const edges = useDesktopStore(selectEdges);
  const activeEdges = useDesktopStore(selectActiveEdges);
  const highlightedEdgeIds = useDesktopStore(selectHighlightedEdgeIds);
  const zoom = useStore((state) => state.transform[2]);

  return useMemo(() => {
    const visibleEdges = filterEdgesByZoom(edges, zoom);

    // Add runtime state to edges
    return visibleEdges.map((edge) => ({
      ...edge,
      animated: activeEdges.has(edge.id),
      selected: highlightedEdgeIds.has(edge.id),
    }));
  }, [edges, zoom, activeEdges, highlightedEdgeIds]);
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
