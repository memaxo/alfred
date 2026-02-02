import type { ReactNode } from "react";

import { createContext, createElement, useContext } from "react";

export type LODLevel = "tiny" | "small" | "medium" | "full";

const THRESHOLD_SMALL = 0.2;
const THRESHOLD_MEDIUM = 0.5;
const THRESHOLD_FULL = 0.8;

/**
 * Level-of-detail (LOD) context.
 *
 * In Mindscape / ReactFlow contexts, a provider may supply `zoom`.
 * In traditional desktop windows (no graph zoom), the default zoom is 1.
 */
const LODContext = createContext<number | null>(null);

export function LODProvider({
  children,
  zoom,
}: {
  children: ReactNode;
  zoom: number;
}) {
  return createElement(LODContext.Provider, { value: zoom }, children);
}

export function useLOD(): LODLevel {
  const zoom = useContext(LODContext) ?? 1;
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
}

export function useLODVisible(minLevel: LODLevel): boolean {
  const currentLOD = useLOD();
  const levels: LODLevel[] = ["tiny", "small", "medium", "full"];
  return levels.indexOf(currentLOD) >= levels.indexOf(minLevel);
}
