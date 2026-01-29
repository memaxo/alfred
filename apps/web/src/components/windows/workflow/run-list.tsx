"use client";

/**
 * Workflow Run List
 *
 * Enhanced list view for workflow runs with filtering,
 * status indicators, and quick actions.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 4
 */

import {
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Square,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { TinyDot } from "../shared";

interface WorkflowRun {
  id: string;
  requirement: string;
  status: "running" | "suspended" | "completed" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
}

interface RunListProps {
  runs: WorkflowRun[];
  selectedRunId?: string;
  onSelectRun: (runId: string) => void;
  onResumeRun?: (runId: string) => void;
  onCancelRun?: (runId: string) => void;
  isLoading?: boolean;
}

type StatusFilter =
  | "all"
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  running: {
    label: "Running",
    icon: <RefreshCw className="h-3 w-3 animate-spin" />,
    color: "blue",
  },
  suspended: {
    label: "Suspended",
    icon: <Clock className="h-3 w-3" />,
    color: "yellow",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "green",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-3 w-3" />,
    color: "red",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Square className="h-3 w-3" />,
    color: "gray",
  },
};

function getStatusConfig(status: string) {
  return (
    statusConfig[status] || {
      label: status,
      icon: <MoreHorizontal className="h-3 w-3" />,
      color: "gray",
    }
  );
}

function formatDuration(start: string, end?: string): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const durationMs = endMs - startMs;

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1000)}s`;
  }
  if (durationMs < 3_600_000) {
    return `${Math.round(durationMs / 60_000)}m`;
  }
  return `${Math.round(durationMs / 3_600_000)}h`;
}

export function RunList({
  runs,
  selectedRunId,
  onSelectRun,
  onResumeRun,
  onCancelRun,
  isLoading,
}: RunListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRuns = runs.filter((run) => {
    // Status filter
    if (statusFilter !== "all" && run.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        run.requirement.toLowerCase().includes(query) ||
        run.id.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort by created date descending
  const sortedRuns = [...filteredRuns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (isLoading) {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading runs...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-3">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            <span className="font-medium">Workflow Runs</span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
              {sortedRuns.length}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-white/5 p-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search runs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Run List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {sortedRuns.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No runs match your filters"
                  : "No workflow runs yet"}
              </div>
            ) : (
              sortedRuns.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  isSelected={run.id === selectedRunId}
                  onClick={() => onSelectRun(run.id)}
                  onResume={() => onResumeRun?.(run.id)}
                  onCancel={() => onCancelRun?.(run.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function RunRow({
  run,
  isSelected,
  onClick,
  onResume,
  onCancel,
}: {
  run: WorkflowRun;
  isSelected: boolean;
  onClick: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const status = getStatusConfig(run.status);
  const isActive = run.status === "running" || run.status === "suspended";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded border p-2 text-left transition-colors ${
        isSelected
          ? "border-blue-500/50 bg-blue-500/10"
          : "border-white/5 bg-white/[0.02] hover:bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{run.requirement}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{run.id.slice(0, 8)}</span>
            <span>•</span>
            <span>{formatDuration(run.createdAt)} ago</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TinyDot
            color={status.color as "blue" | "green" | "red" | "yellow" | "gray"}
          />
          {status.icon}
        </div>
      </div>

      {/* Quick Actions */}
      {isActive && isSelected && (
        <div className="mt-2 flex items-center gap-1">
          {run.status === "suspended" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onResume();
              }}
              className="h-6 px-2 text-xs"
            >
              <Play className="mr-1 h-3 w-3" />
              Resume
            </Button>
          )}
          {run.status === "running" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
            >
              <Square className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </button>
  );
}
