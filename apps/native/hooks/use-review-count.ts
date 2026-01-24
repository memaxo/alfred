import { trpc } from "@/utils/trpc";

/**
 * Hook to get the count of pending reviews for badge display
 */
export function useReviewCount() {
  const { data, isLoading, refetch } = trpc.review.pendingCount.useQuery(
    undefined,
    {
      staleTime: 60_000, // 1 minute cache
      refetchOnWindowFocus: true,
      refetchInterval: 120_000, // Refetch every 2 minutes
    }
  );

  return {
    count: data?.count ?? 0,
    isLoading,
    refetch,
  };
}

export default useReviewCount;
