import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { BiolumText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { type Review, ReviewCard } from "./ReviewCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ReviewCardStackProps {
  reviews: Review[];
  onApprove: (review: Review) => void;
  onReject: (review: Review) => void;
  onTap: (review: Review) => void;
  onComplete: () => void;
}

const STACK_OFFSET = 20;
const STACK_SCALE_FACTOR = 0.05;
const STACK_OPACITY_FACTOR = 0.2;
const MAX_VISIBLE_CARDS = 3;

export function ReviewCardStack({
  reviews,
  onApprove,
  onReject,
  onTap,
  onComplete,
}: ReviewCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isAnimating = useSharedValue(false);

  const visibleReviews = useMemo(
    () => reviews.slice(currentIndex, currentIndex + MAX_VISIBLE_CARDS),
    [reviews, currentIndex]
  );

  const handleSwipeRight = useCallback(
    (review: Review) => {
      if (isAnimating.value) {
        return;
      }
      isAnimating.value = true;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onApprove(review);

      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= reviews.length) {
            onComplete();
          }
          return next;
        });
        isAnimating.value = false;
      }, 300);
    },
    [reviews.length, onApprove, onComplete, isAnimating]
  );

  const handleSwipeLeft = useCallback(
    (review: Review) => {
      if (isAnimating.value) {
        return;
      }
      isAnimating.value = true;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onReject(review);

      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= reviews.length) {
            onComplete();
          }
          return next;
        });
        isAnimating.value = false;
      }, 300);
    },
    [reviews.length, onReject, onComplete, isAnimating]
  );

  const handleTap = useCallback(
    (review: Review) => {
      onTap(review);
    },
    [onTap]
  );

  if (currentIndex >= reviews.length) {
    return (
      <View style={styles.emptyContainer}>
        <HUDSurface elevation={2} style={styles.emptyCard}>
          <BiolumText color="full" size="large" variant="title">
            ✓ All Caught Up!
          </BiolumText>
          <BiolumText
            color="dim"
            size="medium"
            style={styles.emptyText}
            variant="body"
          >
            You've reviewed all pending items.
          </BiolumText>
        </HUDSurface>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <BiolumText color="dim" size="medium" variant="caption">
          {currentIndex + 1} of {reviews.length}
        </BiolumText>
        <View style={styles.progressDots}>
          {reviews.slice(0, Math.min(reviews.length, 10)).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < currentIndex && styles.progressDotComplete,
                index === currentIndex && styles.progressDotActive,
              ]}
            />
          ))}
          {reviews.length > 10 && (
            <BiolumText color="faint" size="small" variant="caption">
              +{reviews.length - 10}
            </BiolumText>
          )}
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.stackContainer}>
        {visibleReviews.map((review, index) => {
          const stackIndex = index;
          const isTopCard = stackIndex === 0;
          const scale = 1 - stackIndex * STACK_SCALE_FACTOR;
          const translateY = stackIndex * STACK_OFFSET;
          const opacity = 1 - stackIndex * STACK_OPACITY_FACTOR;
          const zIndex = MAX_VISIBLE_CARDS - stackIndex;

          return (
            <ReviewCard
              isTopCard={isTopCard}
              key={review.id}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onTap={handleTap}
              opacity={opacity}
              review={review}
              scale={scale}
              translateY={translateY}
              zIndex={zIndex}
            />
          );
        })}
      </View>

      {/* Swipe Indicators */}
      <View style={styles.indicatorContainer}>
        <View style={styles.indicator}>
          <BiolumText size="large" variant="body">
            ❌
          </BiolumText>
          <BiolumText color="faint" size="small" variant="caption">
            Reject
          </BiolumText>
        </View>
        <View style={styles.indicator}>
          <BiolumText size="large" variant="body">
            ✓
          </BiolumText>
          <BiolumText color="faint" size="small" variant="caption">
            Approve
          </BiolumText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  progressDotComplete: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  progressDotActive: {
    backgroundColor: "rgba(255, 255, 255, 1)",
    transform: [{ scale: 1.2 }],
  },
  stackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 60,
    paddingBottom: 40,
  },
  indicator: {
    alignItems: "center",
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyCard: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    textAlign: "center",
  },
});

export default ReviewCardStack;
