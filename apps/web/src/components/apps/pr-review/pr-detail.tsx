"use client";

/**
 * PR Detail - Pull request metadata panel
 */

import { Calendar, GitBranch, MessageSquare, User } from "lucide-react";

import { cn } from "@/lib/utils";

type PRDetailProps = {
  prId: string;
  className?: string;
};

export function PRDetail({ prId: _prId, className }: PRDetailProps) {
  // Mock PR data - will fetch from backend
  const pr = {
    number: 412,
    title: "Phase 0: Type Migration & Architecture Setup",
    description:
      "Migrate core types from ReactFlow to framework-agnostic definitions. Create new store slices for window management.",
    author: "codex-agent",
    branch: "feat/phase-0-types",
    baseBranch: "main",
    comments: 3,
    createdAt: new Date(Date.now() - 3_600_000),
  };

  return (
    <div className={cn("bg-void-surface p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">
            #{pr.number} {pr.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-biolum-dim text-sm">
            {pr.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-biolum-dim text-xs">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>{pr.author}</span>
        </div>
        <div className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          <span>
            {pr.branch} → {pr.baseBranch}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span>{pr.comments} comments</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatRelativeTime(pr.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
