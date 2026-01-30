/**
 * PR Review Application - Phase 3 System Application
 *
 * Review and manage pull requests with diffs, comments, and biometric merge.
 *
 * Features:
 * - PR list with filters
 * - Diff panel with inline comments
 * - Merge controls with biometric verification
 * - CI status display
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.4
 */

import { GitPullRequest, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { DiffPanel } from "./diff-panel";
import { MergeControls } from "./merge-controls";
import { PRDetail } from "./pr-detail";
import { PRList } from "./pr-list";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PRReviewAppProps {
  windowId?: string;
  className?: string;
}

export interface PR {
  id: string;
  number: number;
  title: string;
  author: string;
  status: "open" | "merged" | "closed";
  isDraft: boolean;
  isAgentCreated: boolean;
  repository: string;
  branch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  comments: number;
  reviewStatus: "pending" | "approved" | "changes_requested";
  ciStatus: "pending" | "success" | "failure" | "running";
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function PRReviewApp({
  windowId: _windowId,
  className,
}: PRReviewAppProps) {
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [showDiff, _setShowDiff] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "agent">("open");
  const utils = trpc.useUtils();

  const handleRefresh = useCallback(() => {
    utils.github.pullRequestsList.invalidate();
  }, [utils]);

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="pr-review"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Pull Requests</span>
        </div>

        <div className="flex items-center gap-1">
          <FilterButton
            active={filter === "all"}
            label="All"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "open"}
            label="Open"
            onClick={() => setFilter("open")}
          />
          <FilterButton
            active={filter === "agent"}
            label="Agent"
            onClick={() => setFilter("agent")}
          />
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button
            className="h-7 w-7"
            onClick={handleRefresh}
            size="icon"
            variant="ghost"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PR List */}
        <PRList
          className="w-80 flex-shrink-0 border-white/5 border-r"
          filter={filter}
          onSelect={setSelectedPRId}
          selectedId={selectedPRId}
        />

        {/* Detail + Diff */}
        {selectedPRId ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* PR Detail */}
            <PRDetail
              className="flex-shrink-0 border-white/5 border-b"
              prId={selectedPRId}
            />

            {/* Diff Panel */}
            {showDiff && <DiffPanel className="flex-1" prId={selectedPRId} />}

            {/* Merge Controls */}
            <MergeControls
              className="flex-shrink-0 border-white/5 border-t"
              prId={selectedPRId}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-biolum-dim">
            <div className="text-center">
              <GitPullRequest className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Select a pull request</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded px-2 py-1 text-xs transition-colors",
        active ? "bg-biolum/10 text-biolum" : "text-biolum-dim hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function PRReviewAppWindow(props: WindowComponentProps) {
  return <PRReviewApp className="h-full" windowId={props.window.id} />;
}

export default PRReviewApp;
