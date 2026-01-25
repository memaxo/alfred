"use client";

/**
 * Action Node - Workflow action node
 */

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { FileOutput, Play, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkflowNodeType = "trigger" | "action" | "condition" | "output";

export interface WorkflowNodeData {
  [key: string]: unknown;
  label: string;
  type: WorkflowNodeType;
  description?: string;
  config?: Record<string, unknown>;
}

const typeIcons: Record<WorkflowNodeType, typeof Zap> = {
  trigger: Zap,
  action: Play,
  condition: Play,
  output: FileOutput,
};

const typeColors: Record<WorkflowNodeType, string> = {
  trigger: "border-yellow-500/50 bg-yellow-500/10",
  action: "border-blue-500/50 bg-blue-500/10",
  condition: "border-purple-500/50 bg-purple-500/10",
  output: "border-green-500/50 bg-green-500/10",
};

const iconColors: Record<WorkflowNodeType, string> = {
  trigger: "text-yellow-400",
  action: "text-blue-400",
  condition: "text-purple-400",
  output: "text-green-400",
};

type ActionNodeProps = NodeProps<Node<WorkflowNodeData>>;

export function ActionNode({ data, selected }: ActionNodeProps) {
  const nodeData = data as WorkflowNodeData;
  const Icon = typeIcons[nodeData.type] || Play;
  const colorClass = typeColors[nodeData.type] || typeColors.action;
  const iconColor = iconColors[nodeData.type] || iconColors.action;

  return (
    <>
      <Handle className="!bg-biolum" position={Position.Top} type="target" />

      <div
        className={cn(
          "min-w-32 rounded-lg border-2 px-3 py-2 shadow-lg transition-all",
          colorClass,
          selected && "ring-2 ring-biolum ring-offset-2 ring-offset-void"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColor)} />
          <span className="font-medium text-sm">{nodeData.label}</span>
        </div>

        {nodeData.description && (
          <p className="mt-1 text-biolum-dim text-xs">{nodeData.description}</p>
        )}
      </div>

      <Handle className="!bg-biolum" position={Position.Bottom} type="source" />
    </>
  );
}
