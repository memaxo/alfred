/**
 * Issue Detail - Full issue information panel
 */

import { Calendar, Tag, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface IssueDetailProps {
  issueId: string;
  onClose: () => void;
  className?: string;
}

export function IssueDetail({
  issueId: _issueId,
  onClose,
  className,
}: IssueDetailProps) {
  // Mock issue data
  const issue = {
    identifier: "ALF-414",
    title: "Phase 2: Core Applications",
    description: `Implement foundational desktop applications that integrate with existing backend services.

## Applications
- Chat Application (tRPC streaming)
- Code Editor (Monaco placeholder)
- Agent Waves (orchestration viz)
- Terminal (XTerm.js placeholder)`,
    status: "in_progress",
    priority: 2,
    assignee: "codex-agent",
    labels: ["epic", "frontend", "ui"],
    createdAt: new Date(Date.now() - 259_200_000),
    updatedAt: new Date(),
  };

  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-white/5 border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-biolum-dim text-sm">
              {issue.identifier}
            </span>
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-400">
              In Progress
            </span>
          </div>
          <h2 className="mt-1 font-semibold text-lg">{issue.title}</h2>
        </div>
        <Button
          className="h-8 w-8"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Metadata */}
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-biolum-dim">
              <User className="h-4 w-4" />
              <span>{issue.assignee || "Unassigned"}</span>
            </div>
            <div className="flex items-center gap-2 text-biolum-dim">
              <Calendar className="h-4 w-4" />
              <span>{issue.createdAt.toLocaleDateString()}</span>
            </div>
          </div>

          {/* Labels */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-biolum-dim text-xs">
              <Tag className="h-3 w-3" />
              <span>Labels</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <span
                  className="rounded bg-white/10 px-2 py-0.5 text-xs"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="mb-2 font-medium text-sm">Description</h4>
            <div className="whitespace-pre-wrap rounded-lg border border-white/5 bg-void p-3 text-biolum-dim text-sm">
              {issue.description}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
