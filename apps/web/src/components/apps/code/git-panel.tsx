"use client";

import { ChevronRight, GitBranch, GitCommit, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type GitPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect?: (path: string) => void;
  className?: string;
};

export function GitPanel({
  isOpen,
  onClose: _onClose,
  onFileSelect,
  className,
}: GitPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refetch } = trpc.fs.list.useQuery(
    {
      path: process.cwd?.() ?? "/Users/jackmazac/Development/alfred",
      showHidden: true,
    },
    { enabled: isOpen }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full w-64 flex-col border-white/5 border-l bg-void",
        className
      )}
    >
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Source Control</span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={handleRefresh}
          size="icon"
          variant="ghost"
        >
          <RefreshCw
            className={cn("h-3 w-3", isRefreshing && "animate-spin")}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-1 text-biolum-dim text-xs">
              <GitBranch className="h-3 w-3" />
              <span>Current Branch</span>
            </div>
            <div className="rounded bg-white/5 px-2 py-1 font-mono text-biolum text-sm">
              dev
            </div>
          </div>

          <div className="mb-2 text-biolum-dim text-xs uppercase tracking-wider">
            Changes
          </div>

          <GitStatusSection
            files={[
              { path: "packages/metrics/src/registry.ts", status: "modified" },
            ]}
            onFileSelect={onFileSelect}
            title="Staged"
          />

          <GitStatusSection
            files={[
              { path: "docs/architecture/api-surface.md", status: "modified" },
              {
                path: "docs/architecture/feature-inventory.md",
                status: "modified",
              },
            ]}
            onFileSelect={onFileSelect}
            title="Modified"
          />

          <GitStatusSection
            files={[
              {
                path: "docs/implementation/mindscape-canvas-implementation.md",
                status: "untracked",
              },
              {
                path: "docs/reports/supertonic-crash-analysis.md",
                status: "untracked",
              },
            ]}
            onFileSelect={onFileSelect}
            title="Untracked"
          />

          <div className="mt-4 mb-2 text-biolum-dim text-xs uppercase tracking-wider">
            Recent Commits
          </div>

          <div className="space-y-1">
            <CommitItem
              hash="eff2343a"
              message="fix(web): migrate desktop store to new type system"
            />
            <CommitItem
              hash="7623915a"
              message="fix cognitive package - remove async keyword"
            />
            <CommitItem
              hash="e793d678"
              message="fix API package - remove unused variable"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function GitStatusSection({
  title,
  files,
  onFileSelect,
}: {
  title: string;
  files: Array<{ path: string; status: string }>;
  onFileSelect?: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mb-2">
      <button
        className="flex w-full items-center gap-1 py-1 text-biolum-dim text-xs hover:text-biolum"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            isExpanded && "rotate-90"
          )}
        />
        <span>
          {title} ({files.length})
        </span>
      </button>

      {isExpanded && (
        <div className="ml-2 space-y-0.5">
          {files.map((file) => (
            <button
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-white/5"
              key={file.path}
              onClick={() => onFileSelect?.(file.path)}
              type="button"
            >
              <StatusIndicator status={file.status} />
              <span className="truncate text-biolum-dim">
                {file.path.split("/").pop()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    modified: "text-yellow-400",
    added: "text-green-400",
    deleted: "text-red-400",
    untracked: "text-gray-400",
    staged: "text-blue-400",
  };

  return (
    <span className={cn("font-bold", colors[status] ?? "text-biolum-dim")}>
      {status === "modified"
        ? "M"
        : status === "added"
          ? "A"
          : status === "deleted"
            ? "D"
            : status === "untracked"
              ? "?"
              : "S"}
    </span>
  );
}

function CommitItem({ hash, message }: { hash: string; message: string }) {
  return (
    <div className="rounded bg-white/5 p-2">
      <div className="flex items-center gap-1 text-biolum-dim text-xs">
        <GitCommit className="h-3 w-3" />
        <span className="font-mono">{hash}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs">{message}</p>
    </div>
  );
}
