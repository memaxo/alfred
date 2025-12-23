import { useStore } from "@xyflow/react";

export type LODLevel = "tiny" | "small" | "medium" | "full";

const THRESHOLD_SMALL = 0.2;
const THRESHOLD_MEDIUM = 0.5;
const THRESHOLD_FULL = 0.8;

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

export function useLODVisible(minLevel: LODLevel): boolean {
  const currentLOD = useLOD();
  const levels: LODLevel[] = ["tiny", "small", "medium", "full"];
  return levels.indexOf(currentLOD) >= levels.indexOf(minLevel);
}
