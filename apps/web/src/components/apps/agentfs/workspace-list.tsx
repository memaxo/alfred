"use client";

/**
 * Workspace List - AgentFS workspace list
 */

import { Bot, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { Workspace } from "./index";

type WorkspaceListProps = {
  selectedId: string | null;
  onSelect: (workspace: Workspace) => void;
  className?: string;
};

export function WorkspaceList({
  selectedId,
  onSelect,
  className,
}: WorkspaceListProps) {
  const { data, isLoading, error } = trpc.agentfs.workspacesList.useQuery(
    undefined,
    { refetchInterval: 10_000 }
  );

  const workspaces: Workspace[] = data?.workspaces ?? [];

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          Workspaces
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
              Failed to load workspaces
            </div>
          )}
          {!isLoading && workspaces.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No workspaces found
            </div>
          )}
          {workspaces.map((workspace) => (
            <WorkspaceItem
              isSelected={workspace.id === selectedId}
              key={workspace.id}
              onClick={() => onSelect(workspace)}
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
  const statusColors: Record<string, string> = {
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
              className={cn(
                "h-3 w-3",
                statusColors[workspace.status] ?? "text-biolum-dim"
              )}
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
