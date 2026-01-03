"use client";

/**
 * Process List - Running processes and agents
 */

import { Bot, Server, Square, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ProcessListProps = {
  className?: string;
};

type Process = {
  id: string;
  name: string;
  type: "agent" | "service" | "system";
  status: "running" | "idle" | "stopped";
  cpu: number;
  memory: number;
  uptime: number;
};

// Mock processes
const mockProcesses: Process[] = [
  {
    id: "1",
    name: "orchestrator",
    type: "service",
    status: "running",
    cpu: 5.2,
    memory: 128,
    uptime: 3600,
  },
  {
    id: "2",
    name: "codex-agent",
    type: "agent",
    status: "running",
    cpu: 15.8,
    memory: 512,
    uptime: 1800,
  },
  {
    id: "3",
    name: "droid-agent",
    type: "agent",
    status: "running",
    cpu: 12.3,
    memory: 384,
    uptime: 1800,
  },
  {
    id: "4",
    name: "voice-server",
    type: "service",
    status: "running",
    cpu: 3.1,
    memory: 256,
    uptime: 7200,
  },
  {
    id: "5",
    name: "api-server",
    type: "service",
    status: "running",
    cpu: 8.4,
    memory: 320,
    uptime: 7200,
  },
  {
    id: "6",
    name: "scheduler",
    type: "service",
    status: "idle",
    cpu: 0.1,
    memory: 64,
    uptime: 7200,
  },
];

export function ProcessList({ className }: ProcessListProps) {
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
      <ScrollArea className="flex-1">
        {mockProcesses.map((process) => (
          <ProcessRow key={process.id} process={process} />
        ))}
      </ScrollArea>

      {/* Summary */}
      <div className="flex items-center justify-between border-white/5 border-t px-4 py-2 text-biolum-dim text-xs">
        <span>{mockProcesses.length} processes</span>
        <span>
          Total: CPU {mockProcesses.reduce((a, p) => a + p.cpu, 0).toFixed(1)}%
          | Memory {mockProcesses.reduce((a, p) => a + p.memory, 0)}MB
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
