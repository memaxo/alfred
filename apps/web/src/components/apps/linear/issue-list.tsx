"use client";

/**
 * Issue List - Filterable Linear issue list
 */

import { AlertCircle, CheckCircle, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Issue } from "./index";

type IssueListProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

// Mock issues
const mockIssues: Issue[] = [
  {
    id: "1",
    identifier: "ALF-412",
    title: "Phase 0: Type Migration",
    status: "done",
    priority: 2,
    assignee: "codex",
    labels: ["epic", "frontend"],
    createdAt: new Date(Date.now() - 86_400_000),
    updatedAt: new Date(Date.now() - 3_600_000),
  },
  {
    id: "2",
    identifier: "ALF-413",
    title: "Phase 1: Desktop Shell Foundation",
    status: "done",
    priority: 2,
    assignee: "droid",
    labels: ["epic", "frontend"],
    createdAt: new Date(Date.now() - 172_800_000),
    updatedAt: new Date(Date.now() - 7_200_000),
  },
  {
    id: "3",
    identifier: "ALF-414",
    title: "Phase 2: Core Applications",
    status: "in_progress",
    priority: 2,
    labels: ["epic", "frontend"],
    createdAt: new Date(Date.now() - 259_200_000),
    updatedAt: new Date(),
  },
  {
    id: "4",
    identifier: "ALF-415",
    title: "Phase 3: System Applications",
    status: "in_progress",
    priority: 3,
    labels: ["epic", "frontend"],
    createdAt: new Date(Date.now() - 345_600_000),
    updatedAt: new Date(),
  },
  {
    id: "5",
    identifier: "ALF-416",
    title: "Phase 4: Knowledge & Integration",
    status: "todo",
    priority: 3,
    labels: ["epic", "frontend"],
    createdAt: new Date(Date.now() - 432_000_000),
    updatedAt: new Date(Date.now() - 86_400_000),
  },
];

const statusIcons = {
  backlog: Circle,
  todo: Circle,
  in_progress: AlertCircle,
  done: CheckCircle,
  cancelled: Circle,
};

const statusColors = {
  backlog: "text-biolum-dim",
  todo: "text-biolum-dim",
  in_progress: "text-yellow-400",
  done: "text-green-400",
  cancelled: "text-red-400",
};

const priorityColors = {
  0: "bg-biolum-dim/20",
  1: "bg-red-500/20 text-red-400",
  2: "bg-orange-500/20 text-orange-400",
  3: "bg-yellow-500/20 text-yellow-400",
  4: "bg-blue-500/20 text-blue-400",
};

export function IssueList({ selectedId, onSelect, className }: IssueListProps) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          {mockIssues.length} Issues
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockIssues.map((issue) => (
            <IssueRow
              isSelected={issue.id === selectedId}
              issue={issue}
              key={issue.id}
              onClick={() => onSelect(issue.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function IssueRow({
  issue,
  isSelected,
  onClick,
}: {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
}) {
  const StatusIcon = statusIcons[issue.status];

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
          className={cn("mt-0.5 h-4 w-4", statusColors[issue.status])}
        />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-medium text-biolum-dim text-xs">
              {issue.identifier}
            </span>
            <span
              className={cn(
                "rounded px-1 text-xs",
                priorityColors[issue.priority]
              )}
            >
              P{issue.priority}
            </span>
          </div>
          <p className="truncate text-sm">{issue.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                className="rounded bg-white/10 px-1.5 py-0.5 text-biolum-dim text-xs"
                key={label}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
