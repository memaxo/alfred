import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useReducedMotion, useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;
const ROTATION_ANGLE = 15;
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

export interface Review {
  id: string;
  reviewType: "tool_execution" | "message" | "memory" | "workflow" | "code";
  priority: "low" | "medium" | "high" | "critical";
  subjectData: {
    toolName?: string;
    messageContent?: string;
    memoryFact?: string;
    workflowDecision?: string;
    summary?: string;
    prTitle?: string;
    prNumber?: number;
    bugCount?: number;
  };
  context?: {
    conversationId?: string;
    messageId?: string;
    timestamp?: number;
  };
  confidence?: number;
  createdAt: Date;
}

interface ReviewCardProps {
  review: Review;
  onSwipeRight: (review: Review) => void;
  onSwipeLeft: (review: Review) => void;
  onTap: (review: Review) => void;
  isTopCard: boolean;
  zIndex: number;
  scale?: number;
  translateY?: number;
  opacity?: number;
}

const REVIEW_TYPE_ICONS: Record<Review["reviewType"], string> = {
  tool_execution: "🛠️",
  message: "💬",
  memory: "🧠",
  workflow: "🔄",
  code: "💻",
};

const REVIEW_TYPE_LABELS: Record<Review["reviewType"], string> = {
  tool_execution: "Tool Execution",
  message: "Message Quality",
  memory: "Memory Association",
  workflow: "Workflow Decision",
  code: "Code Review",
};

export function ReviewCard({
  review,
  onSwipeRight,
  onSwipeLeft,
  onTap,
  isTopCard,
  zIndex,
  scale = 1,
  translateY = 0,
  opacity = 1,
}: ReviewCardProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const hapticTriggered = useSharedValue(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSwipeComplete = useCallback(
    (direction: "left" | "right") => {
      if (direction === "right") {
        onSwipeRight(review);
      } else {
        onSwipeLeft(review);
      }
    },
    [review, onSwipeRight, onSwipeLeft]
  );

  const panGesture = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateYValue.value = event.translationY;
      rotateZ.value = (event.translationX / 400) * ROTATION_ANGLE;

      const absTranslate = Math.abs(event.translationX);
      if (absTranslate > SWIPE_THRESHOLD && !hapticTriggered.value) {
        hapticTriggered.value = true;
        runOnJS(triggerHaptic)();
      } else if (absTranslate < SWIPE_THRESHOLD) {
        hapticTriggered.value = false;
      }
    })
    .onEnd((event) => {
      const absTranslateX = Math.abs(translateX.value);
      const velocityX = Math.abs(event.velocityX);

      if (absTranslateX > SWIPE_THRESHOLD || velocityX > 1000) {
        const direction = translateX.value > 0 ? "right" : "left";
        const targetX = direction === "right" ? SCREEN_WIDTH : -SCREEN_WIDTH;

        translateX.value = withSpring(targetX, {
          damping: 20,
          stiffness: 90,
          velocity: event.velocityX,
        });

        runOnJS(handleSwipeComplete)(direction);
      } else {
        translateX.value = withSpring(0);
        translateYValue.value = withSpring(0);
        rotateZ.value = withSpring(0);
        hapticTriggered.value = false;
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    // Respect reduced motion preference - skip rotation and scale animations
    if (reduceMotion) {
      return {
        transform: [{ translateX: translateX.value }, { translateY }],
        opacity,
        zIndex,
      };
    }

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateYValue.value + translateY },
        { rotateZ: `${rotateZ.value}deg` },
        { scale },
      ],
      opacity,
      zIndex,
    };
  });

  const leftGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [0.8, 0],
      Extrapolation.CLAMP
    ),
  }));

  const rightGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 0.8],
      Extrapolation.CLAMP
    ),
  }));

  const getReviewSummary = () => {
    const { subjectData, reviewType } = review;
    switch (reviewType) {
      case "tool_execution": {
        return subjectData.toolName || "Tool Execution";
      }
      case "message": {
        return subjectData.messageContent?.slice(0, 50) || "Message";
      }
      case "memory": {
        return subjectData.memoryFact || "Memory";
      }
      case "workflow": {
        return subjectData.workflowDecision || "Workflow";
      }
      case "code": {
        return (
          subjectData.prTitle || `PR #${subjectData.prNumber}` || "Code Review"
        );
      }
      default: {
        return "Review";
      }
    }
  };

  const handlePress = useCallback(() => {
    onTap(review);
  }, [review, onTap]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, cardStyle]}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.touchable,
            pressed && { opacity: 0.9 },
          ]}
        >
          <HUDSurface elevation={3} style={styles.card}>
            {/* Left Glow (Reject) */}
            <Animated.View
              style={[
                styles.glowOverlay,
                styles.leftGlow,
                leftGlowStyle,
                { backgroundColor: theme.colors.semantic.error },
              ]}
            />

            {/* Right Glow (Approve) */}
            <Animated.View
              style={[
                styles.glowOverlay,
                styles.rightGlow,
                rightGlowStyle,
                { backgroundColor: theme.colors.semantic.success },
              ]}
            />

            {/* Card Content */}
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <BiolumText color="full" size="large" variant="title">
                  {REVIEW_TYPE_ICONS[review.reviewType]}{" "}
                  {REVIEW_TYPE_LABELS[review.reviewType]}
                </BiolumText>
                {review.priority === "critical" ||
                review.priority === "high" ? (
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor:
                          review.priority === "critical"
                            ? `${theme.colors.semantic.error}40`
                            : `${theme.colors.semantic.warning}40`,
                      },
                    ]}
                  >
                    <BiolumText color="bright" size="small" variant="caption">
                      {review.priority.toUpperCase()}
                    </BiolumText>
                  </View>
                ) : null}
              </View>

              {/* Main Content */}
              <View style={styles.mainContent}>
                <BiolumText
                  color="standard"
                  numberOfLines={3}
                  size="large"
                  variant="body"
                >
                  {getReviewSummary()}
                </BiolumText>

                {review.subjectData.summary && (
                  <BiolumText
                    color="dim"
                    numberOfLines={4}
                    size="medium"
                    style={styles.summaryText}
                    variant="body"
                  >
                    {review.subjectData.summary}
                  </BiolumText>
                )}
              </View>

              {/* Context */}
              <View style={styles.contextSection}>
                <BiolumText color="faint" size="medium" variant="caption">
                  {review.createdAt
                    ? `Created ${formatRelativeTime(review.createdAt)}`
                    : "Just now"}
                </BiolumText>
                {review.confidence !== undefined && (
                  <BiolumText color="faint" size="medium" variant="caption">
                    Confidence: {Math.round(review.confidence * 100)}%
                  </BiolumText>
                )}
              </View>

              {/* Code Review Specific */}
              {review.reviewType === "code" &&
                review.subjectData.bugCount !== undefined && (
                  <View style={styles.bugCountSection}>
                    <BiolumText
                      color={review.subjectData.bugCount > 0 ? "full" : "dim"}
                      size="medium"
                      variant="caption"
                    >
                      {review.subjectData.bugCount > 0
                        ? `🔴 ${review.subjectData.bugCount} bugs detected`
                        : "✓ No bugs detected"}
                    </BiolumText>
                  </View>
                )}

              {/* Swipe Hint */}
              <View style={styles.swipeHint}>
                <BiolumText color="faint" size="small" variant="caption">
                  ← Swipe to Reject | Approve →
                </BiolumText>
              </View>

              {/* Tap Hint */}
              <View style={styles.tapHint}>
                <BiolumText color="whisper" size="small" variant="caption">
                  Tap for details
                </BiolumText>
              </View>
            </View>
          </HUDSurface>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  cardContainer: {
    position: "absolute",
    width: CARD_WIDTH,
    alignSelf: "center",
  },
  touchable: {
    width: "100%",
  },
  card: {
    padding: 20,
    minHeight: 350,
  },
  glowOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    borderRadius: 24,
  },
  leftGlow: {
    left: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  rightGlow: {
    right: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mainContent: {
    flex: 1,
    marginBottom: 16,
  },
  summaryText: {
    marginTop: 12,
  },
  contextSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bugCountSection: {
    marginBottom: 12,
  },
  swipeHint: {
    alignItems: "center",
    marginBottom: 8,
  },
  tapHint: {
    alignItems: "center",
  },
});

export default ReviewCard;
