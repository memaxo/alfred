"use client";

/**
 * Linear Integration Application - Phase 4 Knowledge & Integration
 *
 * View and manage Linear issues and project boards.
 *
 * Features:
 * - Issue list with filters
 * - Issue detail panel
 * - Project board (Kanban)
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.6
 */

import { LayoutGrid, List, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { IssueDetail } from "./issue-detail";
import { IssueList } from "./issue-list";
import { ProjectBoard } from "./project-board";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type LinearAppProps = {
  windowId?: string;
  className?: string;
};

export type Issue = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: "backlog" | "todo" | "in_progress" | "done" | "cancelled";
  priority: 0 | 1 | 2 | 3 | 4;
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function LinearApp({ windowId: _windowId, className }: LinearAppProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="linear"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <LinearIcon className="h-4 w-4" />
          <span className="font-medium text-sm">Linear</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            className={cn(
              "h-7 w-7",
              view === "list" && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setView("list")}
            size="icon"
            variant="ghost"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            className={cn(
              "h-7 w-7",
              view === "board" && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setView("board")}
            size="icon"
            variant="ghost"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button className="h-7 gap-1 text-xs" size="sm" variant="ghost">
            <Plus className="h-3 w-3" />
            New Issue
          </Button>
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {view === "list" ? (
          <>
            <IssueList
              className="w-96 flex-shrink-0 border-white/5 border-r"
              onSelect={setSelectedIssueId}
              selectedId={selectedIssueId}
            />
            {selectedIssueId && (
              <IssueDetail
                className="flex-1"
                issueId={selectedIssueId}
                onClose={() => setSelectedIssueId(null)}
              />
            )}
          </>
        ) : (
          <ProjectBoard className="flex-1" onSelectIssue={setSelectedIssueId} />
        )}
      </div>
    </div>
  );
}

function LinearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0zm9-7a7 7 0 0 0-5.47 11.35l9.82-9.82A6.97 6.97 0 0 0 12 5zm5.47 2.65l-9.82 9.82A7 7 0 0 0 12 19a7 7 0 0 0 5.47-11.35z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function LinearAppWindow(props: WindowComponentProps) {
  return <LinearApp className="h-full" windowId={props.window.id} />;
}

export default LinearApp;
