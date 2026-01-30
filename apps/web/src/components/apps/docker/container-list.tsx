/**
 * Container List - Virtualized Docker container list with status
 */

import { Bot, Circle, Pause, Play, Square } from "lucide-react";

import { VirtualList } from "@/components/ui/virtual-list";
import { cn } from "@/lib/utils";

import type { Container } from "./index";

interface ContainerListProps {
  containers: Container[];
  filter: "all" | "running" | "agent";
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  isLoading?: boolean;
  error?: string;
}

export function ContainerList({
  containers,
  filter,
  selectedId,
  onSelect,
  className,
  isLoading,
  error,
}: ContainerListProps) {
  // Apply filter (already filtered from backend, but filter again for safety)
  const filteredContainers = containers.filter((c) => {
    if (filter === "running") {
      return c.status === "running";
    }
    if (filter === "agent") {
      return c.isAgentWorkspace;
    }
    return true;
  });

  return (
    <VirtualList
      className={className}
      data={filteredContainers}
      emptyMessage="No containers found"
      error={error}
      headerText={`${filteredContainers.length} Container${filteredContainers.length !== 1 ? "s" : ""}`}
      isLoading={isLoading}
      renderItem={(container) => (
        <ContainerItem
          container={container}
          isSelected={container.id === selectedId}
          onClick={() => onSelect(container.id)}
        />
      )}
    />
  );
}

function ContainerItem({
  container,
  isSelected,
  onClick,
}: {
  container: Container;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    running: "text-green-400",
    stopped: "text-red-400",
    paused: "text-yellow-400",
    exited: "text-biolum-dim",
  };

  const StatusIcon =
    container.status === "running"
      ? Play
      : container.status === "paused"
        ? Pause
        : container.status === "exited"
          ? Square
          : Circle;

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
          className={cn(
            "mt-0.5 h-4 w-4 flex-shrink-0",
            statusColors[container.status]
          )}
        />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium text-sm">
              {container.name}
            </span>
            {container.isAgentWorkspace && (
              <Bot className="h-3 w-3 text-biolum-dim" />
            )}
          </div>
          <p className="truncate text-biolum-dim text-xs">{container.image}</p>
          {container.status === "running" && (
            <div className="mt-1 flex items-center gap-2 text-biolum-faint text-xs">
              <span>CPU {container.cpuPercent.toFixed(1)}%</span>
              <span>MEM {container.memoryUsage}MB</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
