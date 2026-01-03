"use client";

/**
 * PR List - Filterable list of pull requests
 */

import { Bot, Check, GitPullRequest, Loader2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { PR } from "./index";

type PRListProps = {
  filter: "all" | "open" | "agent";
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

export function PRList({
  filter,
  selectedId,
  onSelect,
  className,
}: PRListProps) {
  const state = filter === "agent" ? "all" : filter === "open" ? "open" : "all";
  const { data, isLoading, error } = trpc.github.pullRequestsList.useQuery(
    { state, limit: 30 },
    { refetchInterval: 30_000 }
  );

  const allPRs: PR[] = data?.pullRequests ?? [];

  // Client-side filter for agent PRs
  const filteredPRs = allPRs.filter((pr) => {
    if (filter === "open") {
      return pr.status === "open";
    }
    if (filter === "agent") {
      return pr.isAgentCreated;
    }
    return true;
  });

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          {filteredPRs.length} Pull Request{filteredPRs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load PRs
            </div>
          )}
          {!isLoading && filteredPRs.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No pull requests found
            </div>
          )}
          {filteredPRs.map((pr) => (
            <PRItem
              isSelected={pr.id === selectedId}
              key={pr.id}
              onClick={() => onSelect(pr.id)}
              pr={pr}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function PRItem({
  pr,
  isSelected,
  onClick,
}: {
  pr: PR;
  isSelected: boolean;
  onClick: () => void;
}) {
  const StatusIcon =
    pr.status === "merged"
      ? Check
      : pr.status === "closed"
        ? X
        : GitPullRequest;
  const statusColor =
    pr.status === "merged"
      ? "text-purple-400"
      : pr.status === "closed"
        ? "text-red-400"
        : "text-green-400";

  return (
    <button
      className={cn(
        "mb-1 w-full rounded-lg p-2 text-left transition-colors",
        isSelected ? "bg-biolum/10 text-biolum" : "hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-2">
        <StatusIcon
          className={cn("mt-0.5 h-4 w-4 flex-shrink-0", statusColor)}
        />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">#{pr.number}</span>
            {pr.isAgentCreated && <Bot className="h-3 w-3 text-biolum-dim" />}
          </div>
          <p className="truncate text-biolum-dim text-xs">{pr.title}</p>
          <div className="mt-1 flex items-center gap-2 text-biolum-faint text-xs">
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

function CIBadge({ status }: { status: PR["ciStatus"] }) {
  const colors = {
    pending: "bg-yellow-500/20 text-yellow-400",
    success: "bg-green-500/20 text-green-400",
    failure: "bg-red-500/20 text-red-400",
    running: "bg-blue-500/20 text-blue-400",
  };

  return (
    <span className={cn("rounded px-1 text-xs", colors[status])}>
      {status === "running"
        ? "CI"
        : status === "success"
          ? "✓"
          : status === "failure"
            ? "✗"
            : "○"}
    </span>
  );
}
