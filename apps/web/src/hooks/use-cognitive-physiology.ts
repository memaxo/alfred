"use client";

import { useMemo } from "react";
import { trpc } from "@/utils/trpc";

/**
 * Hook to fetch and poll cognitive physiology metrics.
 * Provides energy, boredom, and frustration levels.
 */
export function useCognitivePhysiology(streamId = "default") {
  const {
    data: physiology,
    isLoading,
    error,
  } = trpc.cognitive.physiologyGet.useQuery(
    { streamId },
    {
      refetchInterval: 5000, // Poll every 5s for the HUD
      staleTime: 4000,
    }
  );

  const metrics = useMemo(() => {
    if (!physiology) {
      return {
        energy: 1,
        boredom: 0,
        frustration: 0,
        entropy: 0,
      };
    }

    return {
      energy: physiology.energy ?? 1,
      boredom: physiology.boredom ?? 0,
      frustration: physiology.frustration ?? 0,
      entropy: physiology.entropy ?? 0,
    };
  }, [physiology]);

  return {
    ...metrics,
    isLoading,
    error,
  };
}
