"use client";

/**
 * Workspace List - AgentFS workspace list
 */

import { Bot, CheckCircle, Clock, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Workspace } from "./index";

type WorkspaceListProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

// Mock workspaces
const mockWorkspaces: Workspace[] = [
  {
    id: "ws-001",
    runId: "run-abc123",
    agentType: "codex",
    status: "active",
    containerId: "abc123",
    createdAt: new Date(Date.now() - 1_800_000),
    operationCount: 45,
    checkpointCount: 3,
  },
  {
    id: "ws-002",
    runId: "run-def456",
    agentType: "droid",
    status: "completed",
    containerId: "def456",
    createdAt: new Date(Date.now() - 7_200_000),
    operationCount: 128,
    checkpointCount: 8,
  },
  {
    id: "ws-003",
    runId: "run-ghi789",
    agentType: "claude",
    status: "failed",
    containerId: "ghi789",
    createdAt: new Date(Date.now() - 14_400_000),
    operationCount: 23,
    checkpointCount: 1,
  },
];

export function WorkspaceList({
  selectedId,
  onSelect,
  className,
}: WorkspaceListProps) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          Workspaces
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockWorkspaces.map((workspace) => (
            <WorkspaceItem
              isSelected={workspace.id === selectedId}
              key={workspace.id}
              onClick={() => onSelect(workspace.id)}
              workspace={workspace}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function WorkspaceItem({
  workspace,
  isSelected,
  onClick,
}: {
  workspace: Workspace;
  isSelected: boolean;
  onClick: () => void;
}) {
  const StatusIcon =
    workspace.status === "active"
      ? Clock
      : workspace.status === "completed"
        ? CheckCircle
        : XCircle;
  const statusColors = {
    active: "text-blue-400",
    completed: "text-green-400",
    failed: "text-red-400",
  };

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
        <Bot className="mt-0.5 h-4 w-4 flex-shrink-0 text-biolum-dim" />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium text-sm">
              {workspace.runId}
            </span>
            <StatusIcon
              className={cn("h-3 w-3", statusColors[workspace.status])}
            />
          </div>
          <p className="truncate text-biolum-dim text-xs capitalize">
            {workspace.agentType} agent
          </p>
          <div className="mt-1 flex items-center gap-2 text-biolum-faint text-xs">
            <span>{workspace.operationCount} ops</span>
            <span>{workspace.checkpointCount} checkpoints</span>
          </div>
        </div>
      </div>
    </button>
  );
}
