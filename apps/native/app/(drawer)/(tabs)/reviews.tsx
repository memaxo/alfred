import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";

import { VoidContainer } from "@/components/foundation/VoidContainer";
import {
  type Review,
  ReviewCardStack,
  ReviewDetailsModal,
  ReviewQueue,
} from "@/components/review";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { trpc } from "@/utils/trpc";

type ReviewMode = "queue" | "swipe";

export default function ReviewsScreen() {
  const theme = useVoidTheme();
  const [mode, setMode] = useState<ReviewMode>("queue");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Fetch reviews from API
  const {
    data: reviewsData,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.review.queue.useQuery(
    { filter: "all", limit: 20 },
    {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    }
  );

  // Submit review mutation
  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Refetch on screen focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Transform API data to Review type
  const reviews: Review[] = (reviewsData?.reviews ?? []).map(
    (r: {
      id: string;
      reviewType: string;
      priority: string;
      subjectData: unknown;
      confidence: number | null;
      conversationId: string | null;
      messageId: string | null;
      createdAt: string | Date | null;
    }) => ({
      id: r.id,
      reviewType: r.reviewType as Review["reviewType"],
      priority: r.priority as Review["priority"],
      subjectData: r.subjectData as Review["subjectData"],
      confidence: r.confidence ?? undefined,
      context: {
        conversationId: r.conversationId ?? undefined,
        messageId: r.messageId ?? undefined,
      },
      createdAt: new Date(r.createdAt ?? Date.now()),
    })
  );

  const handleStartReviewing = useCallback(() => {
    setMode("swipe");
  }, []);

  const handleReviewPress = useCallback((review: Review) => {
    setSelectedReview(review);
    setDetailsModalVisible(true);
  }, []);

  const handleApprove = useCallback(
    (review: Review) => {
      submitMutation.mutate({
        reviewId: review.id,
        verdict: "approve",
      });
    },
    [submitMutation]
  );

  const handleReject = useCallback(
    (review: Review) => {
      submitMutation.mutate({
        reviewId: review.id,
        verdict: "reject",
      });
    },
    [submitMutation]
  );

  const handleSwipeComplete = useCallback(() => {
    setMode("queue");
  }, []);

  const handleCloseModal = useCallback(() => {
    setDetailsModalVisible(false);
    setSelectedReview(null);
  }, []);

  return (
    <VoidContainer>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {mode === "queue" ? (
          <ReviewQueue
            isLoading={isLoading}
            isRefreshing={isRefetching}
            onRefresh={refetch}
            onReviewPress={handleReviewPress}
            onStartReviewing={handleStartReviewing}
            reviews={reviews}
          />
        ) : (
          <View style={styles.swipeContainer}>
            <ReviewCardStack
              onApprove={handleApprove}
              onComplete={handleSwipeComplete}
              onReject={handleReject}
              onTap={handleReviewPress}
              reviews={reviews}
            />
          </View>
        )}

        <ReviewDetailsModal
          onApprove={handleApprove}
          onClose={handleCloseModal}
          onReject={handleReject}
          review={selectedReview}
          visible={detailsModalVisible}
        />
      </SafeAreaView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipeContainer: {
    flex: 1,
  },
});
