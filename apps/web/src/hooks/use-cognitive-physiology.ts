import { resolveStreamId } from "@alfred/cognitive/stream";
import { useMemo } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

/**
 * Hook to fetch and poll cognitive physiology metrics.
 * Provides energy, boredom, and frustration levels.
 */
export function useCognitivePhysiology(streamId?: string) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  const resolvedStreamId = useMemo(() => {
    if (streamId) {
      return streamId;
    }
    if (userId) {
      return resolveStreamId({
        surface: "system",
        userId,
        fallback: "default",
      });
    }
    return "default";
  }, [streamId, userId]);

  const {
    data: physiology,
    isLoading,
    error,
  } = trpc.cognitive.physiologyGet.useQuery(
    { streamId: resolvedStreamId },
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
    streamId: resolvedStreamId,
    isLoading,
    error,
  };
}
