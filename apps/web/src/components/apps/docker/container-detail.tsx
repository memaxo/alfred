/**
 * Container Detail - Full container information
 */

import {
  Calendar,
  HardDrive,
  Network,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Container } from "./index";

interface ContainerDetailProps {
  containerId: string;
  container?: Container;
  networks?: { name: string }[];
  onRemoved?: () => void;
  className?: string;
}

export function ContainerDetail({
  containerId,
  container: containerProp,
  networks,
  onRemoved,
  className,
}: ContainerDetailProps) {
  const utils = trpc.useUtils();

  const [selectedNetwork, setSelectedNetwork] = useState<string>("");

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

  const removeMutation = trpc.deploy.containersRemove.useMutation({
    onSuccess: () => {
      void utils.deploy.containersList.invalidate();
      onRemoved?.();
    },
  });

  const inspectQuery = trpc.deploy.containersInspect.useQuery(
    { containerId },
    { refetchInterval: containerProp?.status === "running" ? 5000 : false }
  );

  const connectMutation = trpc.deploy.networksConnect.useMutation({
    onSuccess: () => {
      void utils.deploy.containersInspect.invalidate({ containerId });
      void utils.deploy.containersList.invalidate();
    },
  });

  const disconnectMutation = trpc.deploy.networksDisconnect.useMutation({
    onSuccess: () => {
      void utils.deploy.containersInspect.invalidate({ containerId });
      void utils.deploy.containersList.invalidate();
    },
  });

  const handleStart = () => {
    startMutation.mutate({ containerId });
  };

  const handleStop = () => {
    stopMutation.mutate({ containerId });
  };

  const handleRemove = () => {
    if (!confirm(`Remove container ${container.name}?`)) {
      return;
    }
    removeMutation.mutate({ containerId });
  };

  const connectedNetworks = inspectQuery.data?.networks ?? [];
  const mounts = inspectQuery.data?.mounts ?? [];
  const availableNetworks = (networks ?? []).map((n) => n.name).filter(Boolean);
  const canConnect =
    selectedNetwork.trim().length > 0 &&
    !connectMutation.isPending &&
    !connectedNetworks.includes(selectedNetwork);
  const canDisconnect =
    selectedNetwork.trim().length > 0 &&
    !disconnectMutation.isPending &&
    connectedNetworks.includes(selectedNetwork);

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

          <Button
            className="h-8 gap-1"
            disabled={removeMutation.isPending}
            onClick={handleRemove}
            size="sm"
            variant="outline"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
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

      <div className="mt-4 flex flex-wrap items-center gap-2 text-biolum-dim text-xs">
        <span className="text-biolum-faint">Networks:</span>
        {connectedNetworks.length > 0 ? (
          connectedNetworks.map((n) => (
            <span className="rounded bg-white/5 px-2 py-1 font-mono" key={n}>
              {n}
            </span>
          ))
        ) : (
          <span className="text-biolum-dim">None</span>
        )}
      </div>

      {availableNetworks.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select onValueChange={setSelectedNetwork} value={selectedNetwork}>
            <SelectTrigger className="h-8 w-56 border-white/10 bg-void text-xs">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-void-surface">
              {availableNetworks.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="h-8"
            disabled={!canConnect}
            onClick={() =>
              connectMutation.mutate({
                containerId,
                network: selectedNetwork,
              })
            }
            size="sm"
            variant="outline"
          >
            Connect
          </Button>

          <Button
            className="h-8"
            disabled={!canDisconnect}
            onClick={() =>
              disconnectMutation.mutate({
                containerId,
                network: selectedNetwork,
              })
            }
            size="sm"
            variant="ghost"
          >
            Disconnect
          </Button>
        </div>
      )}

      {mounts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-biolum-faint text-xs">Mounts</div>
          <div className="space-y-1 text-biolum-dim text-xs">
            {mounts.map((m) => (
              <div
                className="flex items-center justify-between"
                key={m.destination}
              >
                <span className="truncate font-mono">{m.destination}</span>
                <span className="ml-3 truncate text-biolum-faint">
                  {m.type === "volume" ? (m.name ?? m.source) : m.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
