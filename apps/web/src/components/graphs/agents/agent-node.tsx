"use client";

/**
 * Agent Node - Node type for agent spawn tree
 */

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Bot, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type AgentStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "waiting";

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  role: string;
  status: AgentStatus;
  progress?: number;
  tokens?: number;
}

const statusIcons: Record<AgentStatus, typeof Bot> = {
  idle: Bot,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  waiting: Clock,
};

const statusColors: Record<AgentStatus, string> = {
  idle: "border-gray-500/50 bg-gray-500/10",
  running: "border-blue-500/50 bg-blue-500/10",
  completed: "border-green-500/50 bg-green-500/10",
  failed: "border-red-500/50 bg-red-500/10",
  waiting: "border-yellow-500/50 bg-yellow-500/10",
};

const iconColors: Record<AgentStatus, string> = {
  idle: "text-gray-400",
  running: "text-blue-400 animate-spin",
  completed: "text-green-400",
  failed: "text-red-400",
  waiting: "text-yellow-400",
};

type AgentNodeProps = NodeProps<Node<AgentNodeData>>;

export function AgentNode({ data, selected }: AgentNodeProps) {
  const nodeData = data as AgentNodeData;
  const Icon = statusIcons[nodeData.status];
  const colorClass = statusColors[nodeData.status];
  const iconColor = iconColors[nodeData.status];

  return (
    <>
      <Handle className="!bg-biolum" position={Position.Top} type="target" />

      <div
        className={cn(
          "min-w-36 rounded-lg border-2 px-3 py-2 shadow-lg transition-all",
          colorClass,
          selected && "ring-2 ring-biolum ring-offset-2 ring-offset-void"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColor)} />
          <span className="font-medium text-sm">{nodeData.label}</span>
        </div>

        <div className="mt-1 text-biolum-dim text-xs capitalize">
          {nodeData.role}
        </div>

        {nodeData.progress !== undefined && (
          <div className="mt-2 h-1.5 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${nodeData.progress * 100}%` }}
            />
          </div>
        )}

        {nodeData.tokens !== undefined && (
          <div className="mt-1 text-biolum-dim text-xs">
            {nodeData.tokens.toLocaleString()} tokens
          </div>
        )}
      </div>

      <Handle className="!bg-biolum" position={Position.Bottom} type="source" />
    </>
  );
}
