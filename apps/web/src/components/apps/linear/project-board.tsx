"use client";

/**
 * Project Board - Kanban view of issues
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ProjectBoardProps {
  onSelectIssue: (id: string) => void;
  className?: string;
}

// Mock issues by status
const mockColumns = {
  backlog: [
    {
      id: "6",
      identifier: "ALF-420",
      title: "Phase 8: Testing & Stability",
      priority: 4,
    },
  ],
  todo: [
    {
      id: "5",
      identifier: "ALF-416",
      title: "Phase 4: Knowledge & Integration",
      priority: 3,
    },
    {
      id: "7",
      identifier: "ALF-417",
      title: "Phase 5: Window Management",
      priority: 3,
    },
  ],
  in_progress: [
    {
      id: "3",
      identifier: "ALF-414",
      title: "Phase 2: Core Applications",
      priority: 2,
    },
    {
      id: "4",
      identifier: "ALF-415",
      title: "Phase 3: System Applications",
      priority: 2,
    },
  ],
  done: [
    {
      id: "1",
      identifier: "ALF-412",
      title: "Phase 0: Type Migration",
      priority: 2,
    },
    {
      id: "2",
      identifier: "ALF-413",
      title: "Phase 1: Desktop Shell",
      priority: 2,
    },
  ],
};

const columnConfig = {
  backlog: { label: "Backlog", color: "bg-gray-500" },
  todo: { label: "Todo", color: "bg-blue-500" },
  in_progress: { label: "In Progress", color: "bg-yellow-500" },
  done: { label: "Done", color: "bg-green-500" },
};

export function ProjectBoard({ onSelectIssue, className }: ProjectBoardProps) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto p-4", className)}>
      {Object.entries(mockColumns).map(([status, issues]) => {
        const config = columnConfig[status as keyof typeof columnConfig];
        return (
          <div
            className="flex w-72 flex-shrink-0 flex-col rounded-lg border border-white/5 bg-void"
            key={status}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-white/5 border-b p-3">
              <div className={cn("h-2 w-2 rounded-full", config.color)} />
              <span className="font-medium text-sm">{config.label}</span>
              <span className="ml-auto text-biolum-dim text-xs">
                {issues.length}
              </span>
            </div>

            {/* Issues */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {issues.map((issue) => (
                  <button
                    className="mb-2 w-full rounded-lg border border-white/5 bg-void-surface p-3 text-left transition-colors hover:bg-white/5"
                    key={issue.id}
                    onClick={() => onSelectIssue(issue.id)}
                    type="button"
                  >
                    <div className="mb-1 font-medium text-biolum-dim text-xs">
                      {issue.identifier}
                    </div>
                    <div className="text-sm">{issue.title}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
