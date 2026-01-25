"use client";

/**
 * Agent Card - Individual agent status display
 */

import {
  Bot,
  CheckCircle,
  Cpu,
  Loader2,
  Terminal,
  Wand2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AgentStatus = "pending" | "spawning" | "running" | "completed" | "failed";

interface Agent {
  id: string;
  name: string;
  type: "codex" | "droid" | "claude" | "roo";
  status: AgentStatus;
  progress: number;
  wave: number;
  parentId?: string;
  output?: string;
}

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

const typeIcons = {
  codex: Terminal,
  droid: Cpu,
  claude: Bot,
  roo: Wand2,
};

const typeColors = {
  codex: "text-green-400",
  droid: "text-blue-400",
  claude: "text-orange-400",
  roo: "text-pink-400",
};

export function AgentCard({
  agent,
  isSelected,
  onClick,
  className,
}: AgentCardProps) {
  const Icon = typeIcons[agent.type];

  return (
    <button
      className={cn(
        "flex flex-col rounded-xl border p-3 text-left transition-all",
        isSelected
          ? "border-biolum/30 bg-biolum/5"
          : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10",
        className
      )}
      onClick={onClick}
      type="button"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", typeColors[agent.type])} />
          <span className="font-medium text-sm">{agent.name}</span>
        </div>
        <StatusIndicator status={agent.status} />
      </div>

      {/* Progress */}
      {(agent.status === "running" || agent.status === "spawning") && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-biolum-dim">Progress</span>
            <span className="text-biolum">{agent.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full transition-all",
                agent.status === "spawning"
                  ? "animate-pulse bg-yellow-500"
                  : "bg-biolum"
              )}
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-2 flex items-center gap-2 text-biolum-dim text-xs">
        <span>Wave {agent.wave}</span>
        <span>•</span>
        <span className="capitalize">{agent.type}</span>
      </div>
    </button>
  );
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  switch (status) {
    case "completed": {
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    }
    case "failed": {
      return <XCircle className="h-4 w-4 text-red-400" />;
    }
    case "running": {
      return <Loader2 className="h-4 w-4 animate-spin text-biolum" />;
    }
    case "spawning": {
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />;
    }
    default: {
      return <div className="h-4 w-4 rounded-full bg-white/20" />;
    }
  }
}
