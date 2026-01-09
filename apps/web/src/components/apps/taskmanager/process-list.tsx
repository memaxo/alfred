"use client";

/**
 * Process List - Virtualized running processes and agents
 */

import { Bot, Loader2, Server, Square, Terminal } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type ProcessListProps = {
  className?: string;
};

type Process = {
  id: string;
  name: string;
  type: string;
  status: "running" | "idle" | "stopped";
  cpu: number;
  memory: number;
  uptime: number;
};

export function ProcessList({ className }: ProcessListProps) {
  const { data, isLoading, error, refetch } = trpc.admin.processesList.useQuery(
    undefined,
    {
      refetchInterval: 5000,
      retry: false,
    }
  );

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  const processes: Process[] = data?.processes ?? [];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 font-medium text-biolum-dim text-xs">
        <span className="w-8">Type</span>
        <span className="flex-1">Name</span>
        <span className="w-16 text-right">CPU</span>
        <span className="w-16 text-right">Memory</span>
        <span className="w-20 text-right">Uptime</span>
        <span className="w-16" />
      </div>

      {/* Processes */}
      <div className="flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
          </div>
        )}
        {error && (
          <div className="py-2 text-center text-red-400 text-xs">
            Failed to load processes
          </div>
        )}
        {!isLoading && processes.length === 0 && !error && (
          <div className="py-4 text-center text-biolum-dim text-sm">
            No processes found
          </div>
        )}
        {!(isLoading || error) && processes.length > 0 && (
          <Virtuoso
            className="h-full"
            data={processes}
            itemContent={(_, process) => <ProcessRow process={process} />}
          />
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between border-white/5 border-t px-4 py-2 text-biolum-dim text-xs">
        <span>{processes.length} processes</span>
        <span>
          Total: CPU {processes.reduce((a, p) => a + p.cpu, 0).toFixed(1)}% |
          Memory {processes.reduce((a, p) => a + p.memory, 0)}MB
        </span>
      </div>
    </div>
  );
}

function ProcessRow({ process }: { process: Process }) {
  const Icon =
    process.type === "agent"
      ? Bot
      : process.type === "service"
        ? Server
        : Terminal;
  const statusColors = {
    running: "text-green-400",
    idle: "text-yellow-400",
    stopped: "text-red-400",
  };

  return (
    <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 hover:bg-white/5">
      <Icon className={cn("h-4 w-4", statusColors[process.status])} />
      <span className="flex-1 font-medium text-sm">{process.name}</span>
      <span className="w-16 text-right text-biolum-dim text-xs">
        {process.cpu.toFixed(1)}%
      </span>
      <span className="w-16 text-right text-biolum-dim text-xs">
        {process.memory}MB
      </span>
      <span className="w-20 text-right text-biolum-dim text-xs">
        {formatUptime(process.uptime)}
      </span>
      <div className="flex w-16 justify-end">
        <Button className="h-6 w-6" size="icon" variant="ghost">
          <Square className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
