/**
 * Review Queue Section
 *
 * Displays pending AI action reviews requiring user approval.
 * Supports swipe-based interaction (approve/reject/skip) and batch operations.
 *
 * Features:
 * - Filter by review type (tool, code, memory, workflow, message)
 * - Priority indicators (critical, high, medium, low)
 * - Swipe/card interface for mobile-style interaction
 * - Batch approve/reject for similar items
 * - Real-time count badges
 */

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle,
  Clock,
  Code,
  Filter,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Shield,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ReviewFilter =
  | "all"
  | "tool_execution"
  | "code"
  | "memory"
  | "workflow"
  | "message";

type ReviewPriority = "critical" | "high" | "medium" | "low";
type ReviewStatus = "pending" | "approved" | "rejected" | "skipped";

interface Review {
  id: string;
  reviewType: ReviewFilter;
  priority: ReviewPriority;
  status: ReviewStatus;
  subjectId: string;
  subjectData: Record<string, unknown>;
  confidence: number;
  createdAt: string | Date;
  autoApproveEligible: boolean | null;
  // Code review specific
  codeSource?: "github_pr" | "local_diff" | "agent_output" | null;
  prNumber?: number | null;
  repository?: string | null;
  bugCount?: number | null;
  qualityScore?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewQueueSection() {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string | null>(null);

  // tRPC queries
  const queueQuery = trpc.review.queue.useQuery(
    { filter, limit: 50 },
    { refetchInterval: 10_000 }
  );

  const dashboardQuery = trpc.review.dashboardSummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const utils = trpc.useUtils();

  // Mutations
  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      void utils.review.queue.invalidate();
      void utils.review.pendingCount.invalidate();
      void utils.review.dashboardSummary.invalidate();
    },
  });

  const batchApproveMutation = trpc.review.batchApprove.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      void utils.review.queue.invalidate();
      void utils.review.pendingCount.invalidate();
    },
  });

  // Filter options
  const filterOptions: {
    icon: React.ReactNode;
    label: string;
    value: ReviewFilter;
  }[] = [
    { value: "all", label: "All", icon: <Filter className="h-3.5 w-3.5" /> },
    { value: "code", label: "Code", icon: <Code className="h-3.5 w-3.5" /> },
    {
      value: "tool_execution",
      label: "Tools",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      value: "workflow",
      label: "Workflow",
      icon: <Bot className="h-3.5 w-3.5" />,
    },
    {
      value: "memory",
      label: "Memory",
      icon: <Shield className="h-3.5 w-3.5" />,
    },
    {
      value: "message",
      label: "Messages",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
    },
  ];

  // Transform and filter data
  const reviews: Review[] = useMemo(() => {
    const raw = queueQuery.data?.reviews ?? [];
    return raw
      .filter((r) => r.status === "pending")
      .map((r) => ({
        ...r,
        priority: (r.priority ?? "medium") as ReviewPriority,
        reviewType: (r.reviewType ?? "tool_execution") as ReviewFilter,
        confidence: r.confidence ?? 0.5,
        autoApproveEligible: r.autoApproveEligible ?? false,
      })) as Review[];
  }, [queueQuery.data]);

  // Stats
  const stats = dashboardQuery.data;
  const criticalCount = stats?.pending.critical ?? 0;
  const highCount = stats?.pending.high ?? 0;

  // Handlers
  const handleApprove = useCallback(
    (id: string) => {
      submitMutation.mutate({ reviewId: id, verdict: "approve" });
    },
    [submitMutation]
  );

  const handleReject = useCallback(
    (id: string) => {
      submitMutation.mutate({ reviewId: id, verdict: "reject" });
    },
    [submitMutation]
  );

  const handleSkip = useCallback(
    (id: string) => {
      submitMutation.mutate({ reviewId: id, verdict: "skip" });
    },
    [submitMutation]
  );

  const handleBatchApprove = useCallback(() => {
    if (selectedIds.size > 0) {
      batchApproveMutation.mutate({ reviewIds: [...selectedIds] });
    }
  }, [batchApproveMutation, selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const viewingReview = useMemo(
    () => reviews.find((r) => r.id === viewingId),
    [reviews, viewingId]
  );

  return (
    <div className="flex h-full">
      {/* Main Queue List */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
          <div className="flex items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {filterOptions.map((opt) => (
                <FilterPill
                  active={filter === opt.value}
                  icon={opt.icon}
                  key={opt.value}
                  label={opt.label}
                  onClick={() => setFilter(opt.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            {criticalCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
                {highCount} High
              </Badge>
            )}

            {/* Refresh */}
            <Button
              disabled={queueQuery.isRefetching}
              onClick={() => void queueQuery.refetch()}
              size="icon"
              variant="ghost"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  queueQuery.isRefetching && "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>

        {/* Batch Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex h-10 items-center justify-between border-white/5 border-b bg-biolum/5 px-4">
            <span className="text-sm">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <Button
                className="h-7 gap-1"
                onClick={handleBatchApprove}
                size="sm"
                variant="outline"
              >
                <Check className="h-3.5 w-3.5" />
                Approve All
              </Button>
              <Button
                className="h-7"
                onClick={() => setSelectedIds(new Set())}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Review List */}
        <ScrollArea className="flex-1">
          {reviews.length === 0 ? (
            <EmptyState filter={filter} isLoading={queueQuery.isLoading} />
          ) : (
            <div className="space-y-2 p-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  onApprove={() => handleApprove(review.id)}
                  onReject={() => handleReject(review.id)}
                  onSelect={() => toggleSelection(review.id)}
                  onSkip={() => handleSkip(review.id)}
                  onView={() => setViewingId(review.id)}
                  review={review}
                  selected={selectedIds.has(review.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Panel (when viewing) */}
      {viewingReview && (
        <ReviewDetailPanel
          onApprove={() => handleApprove(viewingReview.id)}
          onClose={() => setViewingId(null)}
          onReject={() => handleReject(viewingReview.id)}
          review={viewingReview}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface FilterPillProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function FilterPill({ active, icon, label, onClick }: FilterPillProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-biolum/20 text-biolum"
          : "bg-white/5 text-biolum-dim hover:bg-white/10 hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

interface ReviewCardProps {
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
  onSkip: () => void;
  onView: () => void;
  review: Review;
  selected: boolean;
}

function ReviewCard({
  onApprove,
  onReject,
  onSelect,
  onSkip,
  onView,
  review,
  selected,
}: ReviewCardProps) {
  const priorityColors: Record<ReviewPriority, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const typeIcons: Record<ReviewFilter, React.ReactNode> = {
    all: <Shield className="h-4 w-4" />,
    code: <Code className="h-4 w-4" />,
    tool_execution: <Zap className="h-4 w-4" />,
    workflow: <Bot className="h-4 w-4" />,
    memory: <Shield className="h-4 w-4" />,
    message: <MessageSquare className="h-4 w-4" />,
  };

  const title = getReviewTitle(review);
  const subtitle = getReviewSubtitle(review);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 transition-all",
        selected
          ? "border-biolum/50 bg-biolum/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      )}
    >
      {/* Selection Checkbox */}
      <button
        className={cn(
          "mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-colors",
          selected
            ? "border-biolum bg-biolum text-void"
            : "border-white/20 hover:border-biolum/50"
        )}
        onClick={onSelect}
        type="button"
      >
        {selected && <Check className="h-3 w-3" />}
      </button>

      {/* Type Icon */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-biolum-dim">
        {typeIcons[review.reviewType]}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1" onClick={onView} role="button">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{title}</span>
          <Badge
            className={cn(
              "flex-shrink-0 border text-[10px]",
              priorityColors[review.priority]
            )}
            variant="outline"
          >
            {review.priority}
          </Badge>
          {review.autoApproveEligible && (
            <Badge className="flex-shrink-0 bg-green-500/10 text-green-400 text-[10px]">
              <CheckCircle className="mr-1 h-3 w-3" />
              Trusted
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-biolum-dim text-xs">{subtitle}</p>
        <div className="mt-2 flex items-center gap-3 text-biolum-faint text-xs">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(review.createdAt)}
          </span>
          <span>Confidence: {Math.round(review.confidence * 100)}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ActionButton
          icon={<Check className="h-4 w-4" />}
          label="Approve"
          onClick={onApprove}
          variant="success"
        />
        <ActionButton
          icon={<X className="h-4 w-4" />}
          label="Reject"
          onClick={onReject}
          variant="danger"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSkip}>
              <Clock className="mr-2 h-4 w-4" />
              Skip for now
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: "success" | "danger";
}

function ActionButton({ icon, label, onClick, variant }: ActionButtonProps) {
  return (
    <Button
      className={cn(
        "h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100",
        variant === "success" &&
          "text-green-400 hover:bg-green-500/10 hover:text-green-300",
        variant === "danger" &&
          "text-red-400 hover:bg-red-500/10 hover:text-red-300"
      )}
      onClick={onClick}
      size="icon"
      title={label}
      variant="ghost"
    >
      {icon}
    </Button>
  );
}

interface ReviewDetailPanelProps {
  onApprove: () => void;
  onClose: () => void;
  onReject: () => void;
  review: Review;
}

function ReviewDetailPanel({
  onApprove,
  onClose,
  onReject,
  review,
}: ReviewDetailPanelProps) {
  return (
    <aside className="flex w-96 flex-col border-white/5 border-l bg-void-surface">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
        <span className="font-medium text-sm">Review Details</span>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Type & Priority */}
          <div className="flex items-center gap-2">
            <Badge className="bg-biolum/10 text-biolum">
              {review.reviewType}
            </Badge>
            <Badge
              className={cn(
                review.priority === "critical" && "bg-red-500/20 text-red-400",
                review.priority === "high" &&
                  "bg-yellow-500/20 text-yellow-400",
                review.priority === "medium" && "bg-blue-500/20 text-blue-400",
                review.priority === "low" && "bg-green-500/20 text-green-400"
              )}
            >
              {review.priority}
            </Badge>
          </div>

          {/* Subject Data Preview */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <h4 className="mb-2 font-medium text-xs uppercase tracking-wider">
              Subject Data
            </h4>
            <pre className="max-h-64 overflow-auto text-xs text-biolum-dim">
              {JSON.stringify(review.subjectData, null, 2)}
            </pre>
          </div>

          {/* Metadata */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-biolum-dim">Confidence</span>
              <span>{Math.round(review.confidence * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-biolum-dim">Created</span>
              <span>{formatRelativeTime(review.createdAt)}</span>
            </div>
            {review.prNumber && (
              <div className="flex justify-between">
                <span className="text-biolum-dim">PR</span>
                <span>#{review.prNumber}</span>
              </div>
            )}
            {review.repository && (
              <div className="flex justify-between">
                <span className="text-biolum-dim">Repository</span>
                <span>{review.repository}</span>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Actions Footer */}
      <div className="flex items-center gap-2 border-white/5 border-t p-4">
        <Button
          className="flex-1 gap-2 bg-green-500/20 text-green-400 hover:bg-green-500/30"
          onClick={onApprove}
        >
          <CheckCircle className="h-4 w-4" />
          Approve
        </Button>
        <Button
          className="flex-1 gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30"
          onClick={onReject}
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </aside>
  );
}

interface EmptyStateProps {
  filter: ReviewFilter;
  isLoading: boolean;
}

function EmptyState({ filter, isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-biolum-dim" />
      </div>
    );
  }

  const messages: Record<ReviewFilter, string> = {
    all: "No pending reviews. AI actions will appear here when they need your approval.",
    code: "No code reviews pending.",
    tool_execution: "No tool executions pending review.",
    workflow: "No workflow decisions pending review.",
    memory: "No memory updates pending review.",
    message: "No message reviews pending.",
  };

  return (
    <div className="flex h-64 flex-col items-center justify-center px-8 text-center">
      <CheckCircle className="mb-4 h-12 w-12 text-green-500/50" />
      <p className="text-biolum-dim text-sm">{messages[filter]}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getReviewTitle(review: Review): string {
  const data = review.subjectData;

  switch (review.reviewType) {
    case "code": {
      const codeData = data as { prTitle?: string; summary?: string };
      return codeData.prTitle ?? codeData.summary ?? "Code Review";
    }
    case "tool_execution": {
      const toolData = data as { toolName?: string };
      return `Tool: ${toolData.toolName ?? "Unknown"}`;
    }
    case "workflow": {
      const wfData = data as { taskDescription?: string };
      return wfData.taskDescription ?? "Workflow Decision";
    }
    case "memory": {
      const memData = data as { fact?: string };
      return memData.fact ?? "Memory Update";
    }
    case "message": {
      const msgData = data as { messageContent?: string };
      return msgData.messageContent ?? "Message Review";
    }
    default: {
      return "Review";
    }
  }
}

function getReviewSubtitle(review: Review): string {
  const data = review.subjectData;

  switch (review.reviewType) {
    case "code": {
      const codeData = data as { files?: { path: string }[] };
      const fileCount = codeData.files?.length ?? 0;
      return `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
    }
    case "tool_execution": {
      const toolData = data as { reasoning?: string };
      return toolData.reasoning ?? "Execution review";
    }
    default: {
      return review.subjectId;
    }
  }
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}
