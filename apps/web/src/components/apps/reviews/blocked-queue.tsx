"use client";

/**
 * BlockedWorkQueue - PM's primary view showing pending reviews that block work
 */

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, ChevronRight, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface BlockedWorkQueueProps {
  onSelectReview: (reviewId: string) => void;
  onShowImpact: (reviewId: string) => void;
  className?: string;
}

export function BlockedWorkQueue({
  onSelectReview,
  onShowImpact,
  className,
}: BlockedWorkQueueProps) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.review.blocked.useQuery(
    { limit: 20 },
    { refetchInterval: 5000 }
  );

  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      utils.review.blocked.invalidate();
      utils.review.riskSummary.invalidate();
      utils.review.activityFeed.invalidate();
    },
  });

  if (isLoading) {
    return <BlockedQueueSkeleton className={className} />;
  }

  const reviews = data ?? [];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Blocked Work</h2>
        </div>
        <Badge variant="secondary">{reviews.length} pending</Badge>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {reviews.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => (
              <BlockedItem
                key={review.id}
                review={review}
                onSelect={() => onSelectReview(review.id)}
                onShowImpact={() => onShowImpact(review.id)}
                onQuickApprove={() => {
                  submitMutation.mutate({
                    reviewId: review.id,
                    verdict: "approve",
                  });
                }}
                isApproving={submitMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BlockedReview {
  id: string;
  reviewType: string;
  subjectData: unknown;
  priority: string;
  createdAt: string | Date | null;
  timeBlockedMs: number;
  risk: "high" | "medium" | "low";
  blockingCount: number;
}

interface BlockedItemProps {
  review: BlockedReview;
  onSelect: () => void;
  onShowImpact: () => void;
  onQuickApprove: () => void;
  isApproving: boolean;
}

function BlockedItem({
  review,
  onSelect,
  onShowImpact,
  onQuickApprove,
  isApproving,
}: BlockedItemProps) {
  const riskColors = {
    high: "border-red-500/40 bg-red-500/5",
    medium: "border-yellow-500/40 bg-yellow-500/5",
    low: "border-green-500/40 bg-green-500/5",
  };

  const riskEmoji = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };

  const subjectData = review.subjectData as Record<string, unknown>;
  const summary = getSummary(review.reviewType, subjectData);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
        "hover:bg-accent/50 transition-colors",
        riskColors[review.risk]
      )}
      onClick={onSelect}
      role="button"
      aria-label={`Review ${summary}, ${review.risk} risk, blocking ${review.blockingCount} tasks`}
    >
      <span className="text-lg shrink-0" aria-hidden="true">
        {riskEmoji[review.risk]}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {summary}
          </span>
          {review.blockingCount > 0 && (
            <Badge variant="outline" className="text-xs shrink-0">
              Blocks {review.blockingCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="capitalize">
            {review.reviewType.replace("_", " ")}
          </span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(review.createdAt!))} blocked
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Show impact analysis"
          onClick={(e) => {
            e.stopPropagation();
            onShowImpact();
          }}
        >
          Impact
        </Button>
        {review.risk === "low" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isApproving}
            aria-label="Quick approve low-risk review"
            onClick={(e) => {
              e.stopPropagation();
              onQuickApprove();
            }}
          >
            <Zap className="w-3 h-3 mr-1" aria-hidden="true" />
            Quick
          </Button>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function getSummary(
  reviewType: string,
  subjectData: Record<string, unknown>
): string {
  switch (reviewType) {
    case "tool_execution": {
      return `Tool: ${subjectData.toolName ?? "unknown"}`;
    }
    case "memory": {
      return `Memory: ${(subjectData.fact as string)?.slice(0, 50) ?? "..."}`;
    }
    case "message": {
      return `Message: ${(subjectData.messageContent as string)?.slice(0, 50) ?? "..."}`;
    }
    case "workflow": {
      return `Workflow: ${subjectData.decision ?? "decision"}`;
    }
    case "code": {
      return `PR #${subjectData.prNumber ?? "?"}: ${subjectData.prTitle ?? "Code review"}`;
    }
    default: {
      return "Review";
    }
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-4">✅</span>
      <p className="text-lg font-medium text-foreground">All clear!</p>
      <p className="text-sm text-muted-foreground">
        No work is currently blocked
      </p>
    </div>
  );
}

function BlockedQueueSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
