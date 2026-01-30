/**
 * PR Reviews Section
 *
 * GitHub pull request review and merge interface.
 * Consolidates the legacy pr-review app into the unified Reviews app.
 *
 * Features:
 * - PR list with status filters (open, merged, closed, agent-created)
 * - PR detail view with metadata
 * - Diff viewer with syntax highlighting
 * - Merge controls with method selection
 * - CI status indicators
 */

import {
  Bot,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  GitBranch,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  User,
  X,
  XCircle,
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

type PRStatus = "open" | "merged" | "closed";
type PRFilter = "all" | "open" | "agent" | "merged";
type CIStatus = "pending" | "success" | "failure" | "running";
type ReviewStatus = "pending" | "approved" | "changes_requested";

interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  status: PRStatus;
  isDraft: boolean;
  isAgentCreated: boolean;
  repository: string;
  branch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  comments: number;
  reviewStatus: ReviewStatus;
  ciStatus: CIStatus;
  createdAt: string;
  updatedAt: string;
  url: string;
  body?: string;
  labels?: string[];
  reviewers?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function PRReviewsSection() {
  const [filter, setFilter] = useState<PRFilter>("open");
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  // tRPC queries
  const prsQuery = trpc.github.pullRequestsList.useQuery(
    { state: filter === "merged" ? "closed" : "open", limit: 30 },
    { refetchInterval: 30_000 }
  );

  const utils = trpc.useUtils();

  // Filter PRs
  const pullRequests: PullRequest[] = useMemo(() => {
    const raw = (prsQuery.data?.pullRequests ?? []) as PullRequest[];
    return raw.filter((pr) => {
      if (filter === "agent") {
        return pr.isAgentCreated;
      }
      if (filter === "merged") {
        return pr.status === "merged";
      }
      if (filter === "open") {
        return pr.status === "open";
      }
      return true;
    });
  }, [prsQuery.data, filter]);

  const selectedPR = useMemo(
    () => pullRequests.find((pr) => pr.id === selectedPRId),
    [pullRequests, selectedPRId]
  );

  // Handlers
  const handleRefresh = useCallback(() => {
    void utils.github.pullRequestsList.invalidate();
  }, [utils]);

  return (
    <div className="flex h-full">
      {/* PR List */}
      <div
        className={cn(
          "flex flex-col border-white/5 border-r transition-all",
          selectedPRId ? "w-80" : "flex-1"
        )}
      >
        {/* Toolbar */}
        <div className="flex h-12 items-center justify-between border-white/5 border-b px-3">
          <div className="flex items-center gap-1">
            <FilterButton
              active={filter === "open"}
              count={pullRequests.filter((p) => p.status === "open").length}
              label="Open"
              onClick={() => setFilter("open")}
            />
            <FilterButton
              active={filter === "agent"}
              label="Agent"
              onClick={() => setFilter("agent")}
            />
            <FilterButton
              active={filter === "merged"}
              label="Merged"
              onClick={() => setFilter("merged")}
            />
            <FilterButton
              active={filter === "all"}
              label="All"
              onClick={() => setFilter("all")}
            />
          </div>

          <Button
            disabled={prsQuery.isRefetching}
            onClick={handleRefresh}
            size="icon"
            variant="ghost"
          >
            <RefreshCw
              className={cn("h-4 w-4", prsQuery.isRefetching && "animate-spin")}
            />
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {pullRequests.length === 0 ? (
            <EmptyState filter={filter} isLoading={prsQuery.isLoading} />
          ) : (
            <div className="space-y-1 p-2">
              {pullRequests.map((pr) => (
                <PRCard
                  key={pr.id}
                  isSelected={pr.id === selectedPRId}
                  onClick={() => setSelectedPRId(pr.id)}
                  pr={pr}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* PR Detail */}
      {selectedPR && (
        <PRDetailPanel
          onClose={() => setSelectedPRId(null)}
          pr={selectedPR}
          showDiff={showDiff}
          onToggleDiff={() => setShowDiff(!showDiff)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface FilterButtonProps {
  active: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}

function FilterButton({ active, count, label, onClick }: FilterButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-biolum/20 text-biolum"
          : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 text-biolum-faint">({count})</span>
      )}
    </button>
  );
}

interface PRCardProps {
  isSelected: boolean;
  onClick: () => void;
  pr: PullRequest;
}

function PRCard({ isSelected, onClick, pr }: PRCardProps) {
  const StatusIcon =
    pr.status === "merged"
      ? GitMerge
      : (pr.status === "closed"
        ? XCircle
        : GitPullRequest);

  const statusColor =
    pr.status === "merged"
      ? "text-purple-400"
      : pr.status === "closed"
        ? "text-red-400"
        : pr.isDraft
          ? "text-gray-400"
          : "text-green-400";

  return (
    <button
      className={cn(
        "w-full rounded-lg p-3 text-left transition-all",
        isSelected ? "bg-biolum/10 ring-1 ring-biolum/30" : "hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-2">
        <StatusIcon
          className={cn("mt-0.5 h-4 w-4 flex-shrink-0", statusColor)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-sm">#{pr.number}</span>
            {pr.isAgentCreated && <Bot className="h-3 w-3 text-biolum-dim" />}
            {pr.isDraft && (
              <Badge className="bg-gray-500/20 text-gray-400 text-[10px]">
                Draft
              </Badge>
            )}
          </div>
          <p className="truncate text-biolum-dim text-xs">{pr.title}</p>
          <div className="mt-1.5 flex items-center gap-2 text-biolum-faint text-xs">
            <span>{pr.author}</span>
            <span>•</span>
            <span className="text-green-400">+{pr.additions}</span>
            <span className="text-red-400">-{pr.deletions}</span>
            <CIBadge status={pr.ciStatus} />
          </div>
        </div>
      </div>
    </button>
  );
}

function CIBadge({ status }: { status: CIStatus }) {
  const config: Record<
    CIStatus,
    { className: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      className: "bg-yellow-500/20 text-yellow-400",
      icon: <Clock className="h-3 w-3" />,
      label: "○",
    },
    running: {
      className: "bg-blue-500/20 text-blue-400",
      icon: <RefreshCw className="h-3 w-3 animate-spin" />,
      label: "CI",
    },
    success: {
      className: "bg-green-500/20 text-green-400",
      icon: <Check className="h-3 w-3" />,
      label: "✓",
    },
    failure: {
      className: "bg-red-500/20 text-red-400",
      icon: <X className="h-3 w-3" />,
      label: "✗",
    },
  };

  const { className, label } = config[status];

  return (
    <span className={cn("rounded px-1 text-[10px]", className)}>{label}</span>
  );
}

interface PRDetailPanelProps {
  onClose: () => void;
  onToggleDiff: () => void;
  pr: PullRequest;
  showDiff: boolean;
}

function PRDetailPanel({
  onClose,
  onToggleDiff,
  pr,
  showDiff,
}: PRDetailPanelProps) {
  const [mergeMethod, setMergeMethod] = useState<"squash" | "merge" | "rebase">(
    "squash"
  );

  const utils = trpc.useUtils();

  const mergeMutation = trpc.github.pullRequestMerge.useMutation({
    onSuccess: () => {
      void utils.github.pullRequestsList.invalidate();
    },
  });

  const diffQuery = trpc.github.pullRequestDiff.useQuery(
    { number: pr.number },
    { enabled: showDiff }
  );

  const handleMerge = useCallback(() => {
    mergeMutation.mutate({ method: mergeMethod, number: pr.number });
  }, [mergeMutation, mergeMethod, pr.number]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
        <div className="flex items-center gap-2 min-w-0">
          <GitPullRequest className="h-4 w-4 text-biolum flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            #{pr.number} {pr.title}
          </span>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Metadata Card */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={pr.status} />
              {pr.reviewStatus !== "pending" && (
                <ReviewBadge status={pr.reviewStatus} />
              )}
              {pr.labels?.map((label) => (
                <Badge
                  className="bg-white/10 text-biolum-dim text-xs"
                  key={label}
                >
                  {label}
                </Badge>
              ))}
            </div>

            <p className="text-biolum-dim text-sm">
              {pr.body || "No description provided."}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetadataItem
                icon={<User className="h-3.5 w-3.5" />}
                label="Author"
                value={pr.author}
              />
              <MetadataItem
                icon={<GitBranch className="h-3.5 w-3.5" />}
                label="Branch"
                value={`${pr.branch} → ${pr.baseBranch}`}
              />
              <MetadataItem
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Comments"
                value={String(pr.comments)}
              />
              <MetadataItem
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Updated"
                value={formatRelativeTime(pr.updatedAt)}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 pt-2 border-white/5 border-t">
              <span className="text-green-400 text-sm">
                +{pr.additions} additions
              </span>
              <span className="text-red-400 text-sm">
                -{pr.deletions} deletions
              </span>
              <span className="text-biolum-dim text-sm">
                {pr.additions + pr.deletions} changes
              </span>
            </div>
          </div>

          {/* Diff Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Changes</h3>
              <Button
                className="h-7 text-xs"
                onClick={onToggleDiff}
                size="sm"
                variant="ghost"
              >
                {showDiff ? "Hide" : "Show"} Diff
              </Button>
            </div>

            {showDiff && (
              <div className="rounded-lg border border-white/10 bg-void font-mono text-xs">
                {diffQuery.isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-biolum-dim" />
                  </div>
                ) : (diffQuery.data?.diff ? (
                  <DiffViewer diff={diffQuery.data.diff} />
                ) : (
                  <div className="flex h-32 items-center justify-center text-biolum-dim">
                    No diff available
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Merge Controls */}
      {pr.status === "open" && (
        <div className="flex items-center gap-2 border-white/5 border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-1" variant="outline">
                {mergeMethod === "squash"
                  ? "Squash"
                  : (mergeMethod === "rebase"
                    ? "Rebase"
                    : "Merge")}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setMergeMethod("squash")}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    mergeMethod !== "squash" && "invisible"
                  )}
                />
                Squash and merge
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMergeMethod("merge")}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    mergeMethod !== "merge" && "invisible"
                  )}
                />
                Create merge commit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMergeMethod("rebase")}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    mergeMethod !== "rebase" && "invisible"
                  )}
                />
                Rebase and merge
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="flex-1 gap-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            disabled={
              mergeMutation.isPending || pr.ciStatus === "failure" || pr.isDraft
            }
            onClick={handleMerge}
          >
            <GitMerge className="h-4 w-4" />
            {mergeMutation.isPending ? "Merging..." : "Merge PR"}
          </Button>

          {pr.ciStatus === "failure" && (
            <span className="text-red-400 text-xs">CI failing</span>
          )}
          {pr.isDraft && <span className="text-biolum-dim text-xs">Draft</span>}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PRStatus }) {
  const config: Record<PRStatus, { className: string; label: string }> = {
    open: { className: "bg-green-500/20 text-green-400", label: "Open" },
    merged: { className: "bg-purple-500/20 text-purple-400", label: "Merged" },
    closed: { className: "bg-red-500/20 text-red-400", label: "Closed" },
  };

  return (
    <Badge className={cn("text-xs", config[status].className)}>
      {config[status].label}
    </Badge>
  );
}

function ReviewBadge({ status }: { status: ReviewStatus }) {
  const config: Record<
    ReviewStatus,
    { className: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      className: "bg-yellow-500/20 text-yellow-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Review Pending",
    },
    approved: {
      className: "bg-green-500/20 text-green-400",
      icon: <CheckCircle className="h-3 w-3" />,
      label: "Approved",
    },
    changes_requested: {
      className: "bg-red-500/20 text-red-400",
      icon: <XCircle className="h-3 w-3" />,
      label: "Changes Requested",
    },
  };

  const { className, label } = config[status];

  return <Badge className={cn("text-xs", className)}>{label}</Badge>;
}

interface MetadataItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetadataItem({ icon, label, value }: MetadataItemProps) {
  return (
    <div className="flex items-center gap-2 text-biolum-dim">
      {icon}
      <span className="text-biolum-faint">{label}:</span>
      <span className="truncate text-biolum">{value}</span>
    </div>
  );
}

interface DiffViewerProps {
  diff: string;
}

function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split("\n");

  return (
    <div className="max-h-96 overflow-auto">
      {lines.map((line, i) => {
        let className = "px-3 py-0.5";
        let prefix = null;

        if (line.startsWith("+++ ") || line.startsWith("--- ")) {
          className += " bg-white/5 text-biolum-dim font-bold";
        } else if (line.startsWith("@@ ")) {
          className += " bg-biolum/10 text-biolum-dim";
        } else if (line.startsWith("+")) {
          className += " bg-green-500/10 text-green-400";
          prefix = "+";
        } else if (line.startsWith("-")) {
          className += " bg-red-500/10 text-red-400";
          prefix = "-";
        } else if (line.startsWith("diff --git")) {
          className += " bg-white/10 text-biolum font-bold mt-2";
        } else {
          className += " text-biolum-dim";
        }

        return (
          <div className={className} key={i}>
            <span className="select-none text-biolum-faint/50 mr-2">
              {String(i + 1).padStart(4, "0")}
            </span>
            {prefix && <span className="select-none mr-1">{prefix}</span>}
            <span className="break-all">{line.replace(/^[+-]/, "")}</span>
          </div>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  filter: PRFilter;
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

  const messages: Record<PRFilter, string> = {
    all: "No pull requests found.",
    open: "No open pull requests.",
    agent: "No agent-created pull requests.",
    merged: "No merged pull requests.",
  };

  return (
    <div className="flex h-64 flex-col items-center justify-center px-8 text-center">
      <GitPullRequest className="mb-4 h-12 w-12 text-biolum-dim/50" />
      <p className="text-biolum-dim text-sm">{messages[filter]}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(date: string): string {
  const d = new Date(date);
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
