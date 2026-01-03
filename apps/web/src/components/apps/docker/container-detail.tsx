"use client";

/**
 * Container Detail - Full container information
 */

import { Calendar, HardDrive, Network, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContainerDetailProps = {
  containerId: string;
  className?: string;
};

export function ContainerDetail({
  containerId,
  className,
}: ContainerDetailProps) {
  // Mock container data
  const container = {
    id: containerId,
    name: "alfred-agentfs-run-001",
    image: "alfred/agentfs:latest",
    status: "running" as const,
    ports: ["3000:3000"],
    created: new Date(Date.now() - 3_600_000),
    volumes: ["/workspace:/workspace:rw"],
    networks: ["alfred-net"],
  };

  return (
    <div className={cn("bg-void-surface p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">{container.name}</h2>
          <p className="mt-1 text-biolum-dim text-sm">{container.image}</p>
        </div>

        <div className="flex items-center gap-2">
          {container.status === "running" ? (
            <Button className="h-8 gap-1" size="sm" variant="outline">
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : (
            <Button className="h-8 gap-1" size="sm" variant="outline">
              <Play className="h-3 w-3" />
              Start
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-biolum-dim text-xs">
        <div className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          <span>{container.ports.join(", ") || "No ports"}</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          <span>
            {container.volumes.length} volume
            {container.volumes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Created {formatRelativeTime(container.created)}</span>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
