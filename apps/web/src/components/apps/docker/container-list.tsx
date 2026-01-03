"use client";

/**
 * Container List - Docker container list with status
 */

import { Bot, Circle, Pause, Play, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Container } from "./index";

type ContainerListProps = {
  filter: "all" | "running" | "agent";
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

// Mock containers
const mockContainers: Container[] = [
  {
    id: "abc123",
    name: "alfred-agentfs-run-001",
    image: "alfred/agentfs:latest",
    status: "running",
    ports: ["3000:3000"],
    created: new Date(Date.now() - 3_600_000),
    cpuPercent: 12.5,
    memoryUsage: 256,
    memoryLimit: 1024,
    isAgentWorkspace: true,
    workspaceId: "ws-001",
  },
  {
    id: "def456",
    name: "postgres",
    image: "pgvector/pgvector:pg16",
    status: "running",
    ports: ["5432:5432"],
    created: new Date(Date.now() - 86_400_000),
    cpuPercent: 2.3,
    memoryUsage: 128,
    memoryLimit: 512,
    isAgentWorkspace: false,
  },
  {
    id: "ghi789",
    name: "redis",
    image: "redis:7-alpine",
    status: "running",
    ports: ["6379:6379"],
    created: new Date(Date.now() - 86_400_000),
    cpuPercent: 0.5,
    memoryUsage: 32,
    memoryLimit: 128,
    isAgentWorkspace: false,
  },
  {
    id: "jkl012",
    name: "alfred-agentfs-run-old",
    image: "alfred/agentfs:latest",
    status: "exited",
    ports: [],
    created: new Date(Date.now() - 172_800_000),
    cpuPercent: 0,
    memoryUsage: 0,
    memoryLimit: 1024,
    isAgentWorkspace: true,
    workspaceId: "ws-old",
  },
];

export function ContainerList({
  filter,
  selectedId,
  onSelect,
  className,
}: ContainerListProps) {
  const filteredContainers = mockContainers.filter((c) => {
    if (filter === "running") {
      return c.status === "running";
    }
    if (filter === "agent") {
      return c.isAgentWorkspace;
    }
    return true;
  });

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          {filteredContainers.length} Container
          {filteredContainers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredContainers.map((container) => (
            <ContainerItem
              container={container}
              isSelected={container.id === selectedId}
              key={container.id}
              onClick={() => onSelect(container.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
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
