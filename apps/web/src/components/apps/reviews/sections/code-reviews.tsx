/**
 * Code Reviews Section
 *
 * Local file reviews and agent output reviews.
 * Provides diff viewing and approval workflow for code changes outside of GitHub PRs.
 *
 * Features:
 * - List of pending code reviews (local diff, agent output)
 * - Diff viewer with file tree
 * - Bug/issue highlighting
 * - Quality score display
 * - Approve/reject with feedback
 */

import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle,
  Clock,
  Code,
  FileCode,
  FileDiff,
  Folder,
  RefreshCw,
  Shield,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CodeSource = "local_diff" | "agent_output" | "github_pr";
type ReviewStatus = "pending" | "approved" | "rejected" | "skipped";
type Severity = "critical" | "warning" | "info";

interface CodeReviewFile {
  path: string;
  status: "added" | "modified" | "deleted" | "moved" | "renamed";
  additions: number;
  deletions: number;
  aiSummary?: string;
}

interface CodeReviewBug {
  id: string;
  file: string;
  line: number;
  severity: Severity;
  category: string;
  message: string;
  suggestion?: string;
  confidence: number;
}

interface CodeReview {
  id: string;
  source: CodeSource;
  prNumber?: number | null;
  prTitle?: string | null;
  repository?: string | null;
  author?: string | null;
  files: CodeReviewFile[];
  bugs: CodeReviewBug[];
  summary?: string | null;
  qualityScore?: number | null;
  status: ReviewStatus;
  createdAt: string | Date;
  subjectData?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CodeReviewsSection() {
  const [filter, setFilter] = useState<CodeSource | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // tRPC queries
  const reviewsQuery = trpc.review.queue.useQuery(
    { filter: "code", limit: 50 },
    { refetchInterval: 15_000 }
  );

  const utils = trpc.useUtils();

  // Transform data
  const reviews: CodeReview[] = useMemo(() => {
    const raw = reviewsQuery.data?.reviews ?? [];
    return raw
      .filter((r) => r.reviewType === "code")
      .map((r) => {
        const subjectData = (r.subjectData ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          source: (r.codeSource ?? "agent_output") as CodeSource,
          prNumber: r.prNumber,
          prTitle:
            (subjectData.prTitle as string) ??
            (subjectData.summary as string) ??
            "Code Review",
          repository: r.repository,
          author: subjectData.author as string | undefined,
          files: (subjectData.files as CodeReviewFile[]) ?? [],
          bugs: (subjectData.bugs as CodeReviewBug[]) ?? [],
          summary: subjectData.summary as string | undefined,
          qualityScore: r.qualityScore ?? undefined,
          status: (r.status ?? "pending") as ReviewStatus,
          createdAt: r.createdAt ?? new Date().toISOString(),
          subjectData,
        };
      })
      .filter((r) => {
        if (filter === "all") {
          return true;
        }
        return r.source === filter;
      });
  }, [reviewsQuery.data, filter]);

  const selectedReview = useMemo(
    () => reviews.find((r) => r.id === selectedId),
    [reviews, selectedId]
  );

  // Mutations
  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      void utils.review.queue.invalidate();
      setSelectedId(null);
    },
  });

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

  return (
    <div className="flex h-full">
      {/* Review List */}
      <div
        className={cn(
          "flex flex-col border-white/5 border-r transition-all",
          selectedId ? "w-72" : "flex-1"
        )}
      >
        {/* Toolbar */}
        <div className="flex h-12 items-center justify-between border-white/5 border-b px-3">
          <div className="flex items-center gap-1">
            <FilterButton
              active={filter === "all"}
              label="All"
              onClick={() => setFilter("all")}
            />
            <FilterButton
              active={filter === "agent_output"}
              label="Agent"
              onClick={() => setFilter("agent_output")}
            />
            <FilterButton
              active={filter === "local_diff"}
              label="Local"
              onClick={() => setFilter("local_diff")}
            />
          </div>

          <Button
            disabled={reviewsQuery.isRefetching}
            onClick={() => void reviewsQuery.refetch()}
            size="icon"
            variant="ghost"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                reviewsQuery.isRefetching && "animate-spin"
              )}
            />
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {reviews.length === 0 ? (
            <EmptyState isLoading={reviewsQuery.isLoading} />
          ) : (
            <div className="space-y-1 p-2">
              {reviews.map((review) => (
                <CodeReviewCard
                  isSelected={review.id === selectedId}
                  key={review.id}
                  onClick={() => {
                    setSelectedId(review.id);
                    setSelectedFile(null);
                  }}
                  review={review}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedReview && (
        <CodeReviewDetail
          onApprove={() => handleApprove(selectedReview.id)}
          onClose={() => setSelectedId(null)}
          onReject={() => handleReject(selectedReview.id)}
          onSelectFile={setSelectedFile}
          review={selectedReview}
          selectedFile={selectedFile}
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
  label: string;
  onClick: () => void;
}

function FilterButton({ active, label, onClick }: FilterButtonProps) {
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
    </button>
  );
}

interface CodeReviewCardProps {
  isSelected: boolean;
  onClick: () => void;
  review: CodeReview;
}

function CodeReviewCard({ isSelected, onClick, review }: CodeReviewCardProps) {
  const totalChanges = review.files.reduce(
    (sum, f) => sum + f.additions + f.deletions,
    0
  );
  const bugCount = review.bugs.length;

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
        <SourceIcon source={review.source} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-sm">
              {review.prTitle ?? "Code Review"}
            </span>
          </div>

          <p className="truncate text-biolum-dim text-xs">
            {review.repository ?? review.author ?? "Local changes"}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-white/10 text-biolum-dim text-[10px]">
              <FileCode className="mr-1 h-3 w-3" />
              {review.files.length} files
            </Badge>

            {bugCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                <Bug className="mr-1 h-3 w-3" />
                {bugCount} issues
              </Badge>
            )}

            {review.qualityScore != null && (
              <QualityBadge score={review.qualityScore} />
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-biolum-faint text-xs">
            <span className="text-green-400">+{totalChanges}</span>
            <span>changes</span>
            <span>•</span>
            <Clock className="h-3 w-3" />
            {formatRelativeTime(review.createdAt)}
          </div>
        </div>
      </div>
    </button>
  );
}

function SourceIcon({ source }: { source: CodeSource }) {
  const icons: Record<CodeSource, React.ReactNode> = {
    github_pr: <Code className="h-4 w-4 text-purple-400" />,
    local_diff: <FileDiff className="h-4 w-4 text-blue-400" />,
    agent_output: <Shield className="h-4 w-4 text-biolum" />,
  };

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
      {icons[source]}
    </div>
  );
}

function QualityBadge({ score }: { score: number | null }) {
  const normalized = Math.min(10, Math.max(0, score ?? 0));
  const colorClass =
    normalized >= 8
      ? "bg-green-500/20 text-green-400"
      : (normalized >= 5
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-red-500/20 text-red-400");

  return (
    <Badge className={cn("text-[10px]", colorClass)}>
      <Star className="mr-1 h-3 w-3" />
      {normalized.toFixed(1)}
    </Badge>
  );
}

interface CodeReviewDetailProps {
  onApprove: () => void;
  onClose: () => void;
  onReject: () => void;
  onSelectFile: (path: string | null) => void;
  review: CodeReview;
  selectedFile: string | null;
}

function CodeReviewDetail({
  onApprove,
  onClose,
  onReject,
  onSelectFile,
  review,
  selectedFile,
}: CodeReviewDetailProps) {
  const [activeTab, setActiveTab] = useState<"files" | "bugs" | "summary">(
    "files"
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Code className="h-4 w-4 text-biolum flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            {review.prTitle ?? "Code Review"}
          </span>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Tree */}
        <div className="flex w-56 flex-col border-white/5 border-r">
          {/* Tabs */}
          <div className="flex border-white/5 border-b">
            <TabButton
              active={activeTab === "files"}
              count={review.files.length}
              label="Files"
              onClick={() => setActiveTab("files")}
            />
            <TabButton
              active={activeTab === "bugs"}
              count={review.bugs.length}
              label="Issues"
              onClick={() => setActiveTab("bugs")}
            />
            <TabButton
              active={activeTab === "summary"}
              label="Summary"
              onClick={() => setActiveTab("summary")}
            />
          </div>

          {/* Tab Content */}
          <ScrollArea className="flex-1">
            {activeTab === "files" && (
              <FileTree
                files={review.files}
                onSelect={onSelectFile}
                selected={selectedFile}
              />
            )}
            {activeTab === "bugs" && (
              <BugList bugs={review.bugs} onSelect={onSelectFile} />
            )}
            {activeTab === "summary" && (
              <SummaryView
                qualityScore={review.qualityScore ?? undefined}
                summary={review.summary ?? undefined}
              />
            )}
          </ScrollArea>
        </div>

        {/* Diff Viewer */}
        <div className="flex flex-1 flex-col">
          {selectedFile ? (
            <FileDiffView
              file={review.files.find((f) => f.path === selectedFile)!}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-biolum-dim">
              <FileCode className="mb-4 h-12 w-12 opacity-20" />
              <p className="text-sm">Select a file to view changes</p>
              {review.summary && (
                <div className="mt-4 max-w-md rounded-lg border border-white/10 bg-white/5 p-4">
                  <h4 className="mb-2 font-medium text-sm">AI Summary</h4>
                  <p className="text-xs">{review.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-white/5 border-t p-4">
        <div className="flex items-center gap-2 text-sm text-biolum-dim">
          <span>{review.files.length} files</span>
          <span>•</span>
          <span>{review.bugs.length} issues</span>
          {review.qualityScore != null && (
            <>
              <span>•</span>
              <span>Quality: {review.qualityScore.toFixed(1)}/10</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30"
            onClick={onReject}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button
            className="gap-2 bg-green-500/20 text-green-400 hover:bg-green-500/30"
            onClick={onApprove}
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}

function TabButton({ active, count, label, onClick }: TabButtonProps) {
  return (
    <button
      className={cn(
        "flex-1 border-b-2 py-2 text-xs font-medium transition-colors",
        active
          ? "border-biolum text-biolum"
          : "border-transparent text-biolum-dim hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-biolum-faint">({count})</span>
      )}
    </button>
  );
}

interface FileTreeProps {
  files: CodeReviewFile[];
  onSelect: (path: string) => void;
  selected: string | null;
}

function FileTree({ files, onSelect, selected }: FileTreeProps) {
  // Group files by directory
  const groups = useMemo(() => {
    const map = new Map<string, CodeReviewFile[]>();
    for (const file of files) {
      const dir = file.path.split("/").slice(0, -1).join("/") || "/";
      const existing = map.get(dir) ?? [];
      existing.push(file);
      map.set(dir, existing);
    }
    return map;
  }, [files]);

  return (
    <div className="p-2">
      {[...groups.entries()].map(([dir, dirFiles]) => (
        <div className="mb-2" key={dir}>
          {dir !== "/" && (
            <div className="flex items-center gap-1 px-2 py-1 text-biolum-faint text-xs">
              <Folder className="h-3 w-3" />
              <span className="truncate">{dir}</span>
            </div>
          )}
          {dirFiles.map((file) => (
            <button
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors",
                selected === file.path
                  ? "bg-biolum/20 text-biolum"
                  : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
              )}
              key={file.path}
              onClick={() => onSelect(file.path)}
              type="button"
            >
              <span className="flex items-center gap-1 truncate">
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{file.path.split("/").pop()}</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {file.additions > 0 && (
                  <span className="text-green-400">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-400">-{file.deletions}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

interface BugListProps {
  bugs: CodeReviewBug[];
  onSelect: (path: string) => void;
}

function BugList({ bugs, onSelect }: BugListProps) {
  if (bugs.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-biolum-dim">
        <Check className="mb-2 h-8 w-8 text-green-400/50" />
        <p className="text-xs">No issues found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {bugs.map((bug) => (
        <button
          className="w-full rounded border border-white/10 bg-white/5 p-2 text-left transition-colors hover:border-white/20"
          key={bug.id}
          onClick={() => onSelect(bug.file)}
          type="button"
        >
          <div className="flex items-start gap-2">
            <SeverityIcon severity={bug.severity} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{bug.message}</p>
              <p className="truncate text-biolum-faint text-xs">
                {bug.file}:{bug.line}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="bg-white/10 text-[10px]">
                  {bug.category}
                </Badge>
                <span className="text-biolum-faint text-[10px]">
                  {Math.round(bug.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: "text-red-400",
    warning: "text-yellow-400",
    info: "text-blue-400",
  };

  return (
    <AlertTriangle className={cn("h-4 w-4 flex-shrink-0", colors[severity])} />
  );
}

interface SummaryViewProps {
  qualityScore?: number;
  summary?: string;
}

function SummaryView({ qualityScore, summary }: SummaryViewProps) {
  return (
    <div className="space-y-4 p-4">
      {qualityScore !== undefined && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-biolum-dim">
            Quality Score
          </h4>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold",
                qualityScore >= 8
                  ? "bg-green-500/20 text-green-400"
                  : (qualityScore >= 5
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400")
              )}
            >
              {qualityScore.toFixed(1)}
            </div>
            <div className="text-xs text-biolum-dim">
              <p>Out of 10 points</p>
              <p>
                {qualityScore >= 8
                  ? "Excellent quality"
                  : (qualityScore >= 5
                    ? "Good with minor issues"
                    : "Needs improvement")}
              </p>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-biolum-dim">
            AI Summary
          </h4>
          <p className="text-sm text-biolum-dim">{summary}</p>
        </div>
      )}
    </div>
  );
}

interface FileDiffViewProps {
  file: CodeReviewFile;
}

function FileDiffView({ file }: FileDiffViewProps) {
  // Mock diff content - in production, this would come from the backend
  const mockDiff = `diff --git a/${file.path} b/${file.path}
--- a/${file.path}
+++ b/${file.path}
@@ -1,5 +1,10 @@
 import { useState } from "react";
 
+// New feature implementation
+export function newFeature() {
+  return "Hello, ALFRED!";
+}
+
 export function Component() {
   const [state, setState] = useState(0);`;

  return (
    <ScrollArea className="h-full">
      <div className="font-mono text-xs">
        {/* File Header */}
        <div className="flex items-center justify-between border-white/5 border-b bg-white/5 px-4 py-2">
          <span className="text-biolum">{file.path}</span>
          <div className="flex items-center gap-2">
            {file.additions > 0 && (
              <span className="text-green-400">+{file.additions}</span>
            )}
            {file.deletions > 0 && (
              <span className="text-red-400">-{file.deletions}</span>
            )}
            <Badge className="bg-white/10 text-[10px]">{file.status}</Badge>
          </div>
        </div>

        {/* Diff Content */}
        <div className="p-4">
          {mockDiff.split("\n").map((line, i) => {
            let className = "py-0.5";
            let content = line;

            if (line.startsWith("+++ ") || line.startsWith("--- ")) {
              className += " bg-white/5 text-biolum-dim font-bold";
            } else if (line.startsWith("@@ ")) {
              className += " bg-biolum/10 text-biolum-dim";
            } else if (line.startsWith("+")) {
              className += " bg-green-500/10 text-green-400";
              content = line.slice(1);
            } else if (line.startsWith("-")) {
              className += " bg-red-500/10 text-red-400";
              content = line.slice(1);
            } else if (line.startsWith("diff ")) {
              className += " text-biolum-faint mt-4";
            }

            return (
              <div className={className} key={i}>
                <span className="select-none text-biolum-faint/30 mr-4 w-8 inline-block text-right">
                  {i + 1}
                </span>
                {content}
              </div>
            );
          })}
        </div>

        {/* AI Summary */}
        {file.aiSummary && (
          <div className="mx-4 mb-4 rounded-lg border border-biolum/20 bg-biolum/5 p-3">
            <h4 className="mb-1 text-xs font-medium text-biolum">AI Summary</h4>
            <p className="text-xs text-biolum-dim">{file.aiSummary}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

interface EmptyStateProps {
  isLoading: boolean;
}

function EmptyState({ isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-biolum-dim" />
      </div>
    );
  }

  return (
    <div className="flex h-64 flex-col items-center justify-center px-8 text-center">
      <CheckCircle className="mb-4 h-12 w-12 text-green-500/50" />
      <p className="text-biolum-dim text-sm">No pending code reviews.</p>
      <p className="mt-1 text-biolum-faint text-xs">
        Code changes from agents or local diffs will appear here.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
