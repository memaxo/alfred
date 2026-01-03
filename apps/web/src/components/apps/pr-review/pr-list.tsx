"use client";

/**
 * PR List - Filterable list of pull requests
 */

import { Bot, Check, GitPullRequest, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PR } from "./index";

type PRListProps = {
  filter: "all" | "open" | "agent";
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

// Mock PRs
const mockPRs: PR[] = [
  {
    id: "1",
    number: 412,
    title: "Phase 0: Type Migration & Architecture Setup",
    author: "codex-agent",
    status: "open",
    isDraft: false,
    isAgentCreated: true,
    repository: "alfred",
    branch: "feat/phase-0-types",
    baseBranch: "main",
    additions: 1500,
    deletions: 200,
    comments: 3,
    reviewStatus: "pending",
    ciStatus: "success",
    createdAt: new Date(Date.now() - 3_600_000),
    updatedAt: new Date(Date.now() - 1_800_000),
  },
  {
    id: "2",
    number: 413,
    title: "Phase 1: Desktop Shell Foundation",
    author: "droid-agent",
    status: "open",
    isDraft: false,
    isAgentCreated: true,
    repository: "alfred",
    branch: "feat/phase-1-shell",
    baseBranch: "main",
    additions: 1337,
    deletions: 50,
    comments: 0,
    reviewStatus: "pending",
    ciStatus: "running",
    createdAt: new Date(Date.now() - 7_200_000),
    updatedAt: new Date(Date.now() - 3_600_000),
  },
  {
    id: "3",
    number: 410,
    title: "Fix voice router streaming",
    author: "jack",
    status: "merged",
    isDraft: false,
    isAgentCreated: false,
    repository: "alfred",
    branch: "fix/voice-streaming",
    baseBranch: "main",
    additions: 45,
    deletions: 12,
    comments: 2,
    reviewStatus: "approved",
    ciStatus: "success",
    createdAt: new Date(Date.now() - 86_400_000),
    updatedAt: new Date(Date.now() - 82_800_000),
  },
];

export function PRList({
  filter,
  selectedId,
  onSelect,
  className,
}: PRListProps) {
  const filteredPRs = mockPRs.filter((pr) => {
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
