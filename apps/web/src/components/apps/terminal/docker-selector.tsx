"use client";

import { Container, Loader2, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: "running" | "paused" | "exited" | "created";
}

interface ApiContainer {
  id?: string;
  name?: string;
  image?: string;
  status?: string;
  state: "running" | "paused" | "exited" | "created";
}

interface DockerSelectorProps {
  onSelect: (container: DockerContainer) => void;
  onClose: () => void;
  className?: string;
}

export function DockerSelector({
  onSelect,
  onClose,
  className,
}: DockerSelectorProps) {
  const {
    data: containers,
    isLoading,
    refetch,
  } = trpc.terminal.listContainers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const runningContainers = (containers ?? []).filter(
    (
      c
    ): c is ApiContainer & {
      id: string;
      name: string;
      image: string;
      status: string;
    } => c.state === "running" && !!c.id && !!c.name && !!c.image && !!c.status
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "flex max-h-[80vh] w-96 flex-col rounded-xl border border-white/10 bg-void-surface shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-white/5 border-b p-3">
          <span className="font-medium text-sm">Select Docker Container</span>
          <div className="flex items-center gap-1">
            <Button
              className="h-6 w-6"
              onClick={() => refetch()}
              size="icon"
              title="Refresh"
              variant="ghost"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-6 w-6"
              onClick={onClose}
              size="icon"
              title="Close"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
            </div>
          ) : (runningContainers.length === 0 ? (
            <div className="py-8 text-center text-biolum-dim text-sm">
              <Container className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p>No running containers found</p>
              <p className="mt-1 text-xs">Start a container to connect</p>
            </div>
          ) : (
            <div className="space-y-1">
              {runningContainers.map((container) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
                  key={container.id}
                  onClick={() => onSelect(container)}
                  type="button"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                    <Container className="h-4 w-4 text-biolum" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {container.name}
                    </div>
                    <div className="truncate text-biolum-dim text-xs">
                      {container.image}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-biolum-dim text-xs">
                      {container.state}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="border-white/5 border-t p-2">
          <p className="px-2 text-biolum-dim text-xs">
            Only running containers are shown
          </p>
        </div>
      </div>
    </div>
  );
}
