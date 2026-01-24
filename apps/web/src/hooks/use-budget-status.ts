import { trpc } from "@/utils/trpc";

/**
 * Hook to fetch budget status for a session.
 *
 * @param sessionId - Session ID (e.g., conversation ID or workflow run ID)
 * @returns Budget status query result with cost, usage, and health information
 */
export function useBudgetStatus(sessionId: string | null) {
  return trpc.metrics.getBudgetStatus.useQuery(
    { sessionId: sessionId ?? "" },
    {
      enabled: !!sessionId && sessionId.length > 0,
      refetchInterval: 5000, // Refresh every 5 seconds
    }
  );
}
