"use client";

/**
 * Container Detail - Full container information
 */

import { Calendar, HardDrive, Network, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { Container } from "./index";

type ContainerDetailProps = {
  containerId: string;
  container?: Container;
  className?: string;
};

export function ContainerDetail({
  containerId,
  container: containerProp,
  className,
}: ContainerDetailProps) {
  const utils = trpc.useUtils();

  // Use prop if provided, otherwise show minimal info
  const container = containerProp ?? {
    id: containerId,
    name: containerId,
    image: "unknown",
    status: "exited" as const,
    ports: [],
    created: new Date().toISOString(),
  };

  const startMutation = trpc.deploy.containersStart.useMutation({
    onSuccess: () => {
      void utils.deploy.containersList.invalidate();
    },
  });

  const stopMutation = trpc.deploy.containersStop.useMutation({
    onSuccess: () => {
      void utils.deploy.containersList.invalidate();
    },
  });

  const handleStart = () => {
    startMutation.mutate({ containerId });
  };

  const handleStop = () => {
    stopMutation.mutate({ containerId });
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
            <Button
              className="h-8 gap-1"
              disabled={stopMutation.isPending}
              onClick={handleStop}
              size="sm"
              variant="outline"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : (
            <Button
              className="h-8 gap-1"
              disabled={startMutation.isPending}
              onClick={handleStart}
              size="sm"
              variant="outline"
            >
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
          <span>ID: {container.id.slice(0, 12)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Created {formatRelativeTime(container.created)}</span>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(created: string): string {
  const date = new Date(created);
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
