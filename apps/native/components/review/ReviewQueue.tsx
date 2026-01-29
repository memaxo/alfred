import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

import type { Review } from "./ReviewCard";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";
import { FluidButton } from "../foundation/FluidButton";
import { HUDSurface } from "../foundation/HUDSurface";

type ReviewFilter =
  | "all"
  | "tool_execution"
  | "message"
  | "memory"
  | "workflow"
  | "code";

interface ReviewQueueProps {
  reviews: Review[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onStartReviewing: () => void;
  onReviewPress: (review: Review) => void;
}

const FILTER_OPTIONS: { key: ReviewFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "📋" },
  { key: "code", label: "Code", icon: "💻" },
  { key: "tool_execution", label: "Tools", icon: "🛠️" },
  { key: "memory", label: "Memory", icon: "🧠" },
  { key: "workflow", label: "Workflow", icon: "🔄" },
];

const REVIEW_TYPE_ICONS: Record<Review["reviewType"], string> = {
  tool_execution: "🛠️",
  message: "💬",
  memory: "🧠",
  workflow: "🔄",
  code: "💻",
};

export function ReviewQueue({
  reviews,
  isLoading,
  isRefreshing = false,
  onRefresh,
  onStartReviewing,
  onReviewPress,
}: ReviewQueueProps) {
  const theme = useVoidTheme();
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const filteredReviews = reviews.filter((review) => {
    if (filter === "all") {
      return true;
    }
    return review.reviewType === filter;
  });

  const renderFilterPill = useCallback(
    ({ key, label, icon }: (typeof FILTER_OPTIONS)[number]) => {
      const isActive = filter === key;
      return (
        <Pressable
          key={key}
          onPress={() => setFilter(key)}
          style={({ pressed }) => [
            styles.filterPill,
            isActive && { backgroundColor: theme.colors.glass.active },
            pressed && { opacity: 0.7 },
          ]}
        >
          <BiolumText
            color={isActive ? "full" : "dim"}
            size="medium"
            variant="caption"
          >
            {icon} {label}
          </BiolumText>
        </Pressable>
      );
    },
    [filter, theme]
  );

  const renderReviewItem = useCallback(
    ({ item }: { item: Review }) => (
      <MemoizedReviewItem item={item} onPress={onReviewPress} theme={theme} />
    ),
    [theme, onReviewPress]
  );

  if (isLoading && reviews.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.biolum.standard} />
        <BiolumText
          color="dim"
          size="medium"
          style={styles.loadingText}
          variant="body"
        >
          Loading reviews...
        </BiolumText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BiolumText color="full" size="medium" variant="display">
          Reviews
        </BiolumText>
        <View style={styles.badgeContainer}>
          <BiolumText color="bright" size="medium" variant="body">
            🔔 {reviews.length}
          </BiolumText>
        </View>
      </View>

      <BiolumText
        color="dim"
        size="medium"
        style={styles.subtitle}
        variant="body"
      >
        Pending actions waiting for validation
      </BiolumText>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map(renderFilterPill)}
      </View>

      {/* Review List */}
      {filteredReviews.length > 0 ? (
        <FlashList
          contentContainerStyle={styles.listContent}
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
          estimatedItemSize={120}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                onRefresh={onRefresh}
                refreshing={isRefreshing}
                tintColor={theme.colors.biolum.dim}
              />
            ) : undefined
          }
          renderItem={renderReviewItem}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <BiolumText color="dim" size="large" variant="body">
            No {filter === "all" ? "" : filter.replace("_", " ")} reviews
          </BiolumText>
        </View>
      )}

      {/* Start Reviewing Button */}
      {filteredReviews.length > 0 && (
        <View style={styles.buttonContainer}>
          <FluidButton
            label={`Start Reviewing (${filteredReviews.length})`}
            onPress={onStartReviewing}
          />
        </View>
      )}
    </View>
  );
}

function getReviewTitle(review: Review): string {
  switch (review.reviewType) {
    case "tool_execution": {
      return review.subjectData.toolName || "Tool Execution";
    }
    case "message": {
      return "Message Quality";
    }
    case "memory": {
      return "Memory Association";
    }
    case "workflow": {
      return "Workflow Decision";
    }
    case "code": {
      return (
        review.subjectData.prTitle ||
        `PR #${review.subjectData.prNumber}` ||
        "Code Review"
      );
    }
    default: {
      return "Review";
    }
  }
}

function getReviewSummary(review: Review): string {
  switch (review.reviewType) {
    case "tool_execution": {
      return review.subjectData.summary || "Tool execution pending review";
    }
    case "message": {
      return (
        review.subjectData.messageContent?.slice(0, 100) ||
        "Message pending review"
      );
    }
    case "memory": {
      return (
        review.subjectData.memoryFact || "Memory association pending review"
      );
    }
    case "workflow": {
      return (
        review.subjectData.workflowDecision ||
        "Workflow decision pending review"
      );
    }
    case "code": {
      return review.subjectData.summary || "Code changes pending review";
    }
    default: {
      return "Pending review";
    }
  }
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

interface ReviewItemProps {
  item: Review;
  onPress: (review: Review) => void;
  theme: ReturnType<typeof useVoidTheme>;
}

function ReviewItem({ item, onPress, theme }: ReviewItemProps) {
  const priorityBadgeStyle =
    item.priority === "critical"
      ? { backgroundColor: `${theme.colors.semantic.error}40` }
      : item.priority === "high"
        ? { backgroundColor: `${theme.colors.semantic.warning}40` }
        : undefined;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <HUDSurface elevation={2} style={styles.reviewItem}>
        <View style={styles.reviewItemHeader}>
          <BiolumText color="bright" size="large" variant="body">
            {REVIEW_TYPE_ICONS[item.reviewType]} {getReviewTitle(item)}
          </BiolumText>
          {(item.priority === "critical" || item.priority === "high") && (
            <View style={[styles.priorityBadge, priorityBadgeStyle]}>
              <BiolumText color="bright" size="small" variant="caption">
                {item.priority.toUpperCase()}
              </BiolumText>
            </View>
          )}
        </View>

        <BiolumText
          color="dim"
          numberOfLines={2}
          size="medium"
          style={styles.reviewItemSummary}
          variant="caption"
        >
          {getReviewSummary(item)}
        </BiolumText>

        <View style={styles.reviewItemFooter}>
          <BiolumText color="faint" size="small" variant="caption">
            {formatRelativeTime(item.createdAt)}
          </BiolumText>
          {item.confidence !== undefined && (
            <BiolumText color="faint" size="small" variant="caption">
              Confidence: {Math.round(item.confidence * 100)}%
            </BiolumText>
          )}
        </View>

        {item.reviewType === "code" &&
          item.subjectData.bugCount !== undefined && (
            <View style={styles.bugIndicator}>
              <BiolumText
                color={item.subjectData.bugCount > 0 ? "full" : "dim"}
                size="small"
                variant="caption"
              >
                {item.subjectData.bugCount > 0
                  ? `🔴 ${item.subjectData.bugCount} bugs`
                  : "✓ No bugs"}
              </BiolumText>
            </View>
          )}
      </HUDSurface>
    </Pressable>
  );
}

const MemoizedReviewItem = memo(
  ReviewItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onPress === next.onPress &&
    prev.theme === next.theme
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  badgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
  },
  subtitle: {
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  listContent: {
    paddingBottom: 100,
    gap: 12,
  },
  reviewItem: {
    padding: 16,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewItemSummary: {
    marginBottom: 8,
  },
  reviewItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bugIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ReviewQueue;
