"use client";

/**
 * Entity Node - Custom node type for Mindscape entities
 */

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  Bot,
  Brain,
  FileText,
  Lightbulb,
  MessageSquare,
  Monitor,
} from "lucide-react";

import type { MindscapeNodeData, MindscapeNodeType } from "@/store/mindscape";

import { cn } from "@/lib/utils";

const typeIcons: Record<MindscapeNodeType, typeof Brain> = {
  entity: Brain,
  concept: Lightbulb,
  note: FileText,
  conversation: MessageSquare,
  window: Monitor,
  agent: Bot,
};

const typeColors: Record<MindscapeNodeType, string> = {
  entity: "border-purple-500/50 bg-purple-500/10",
  concept: "border-biolum/50 bg-biolum/10",
  note: "border-yellow-500/50 bg-yellow-500/10",
  conversation: "border-blue-500/50 bg-blue-500/10",
  window: "border-orange-500/50 bg-orange-500/10",
  agent: "border-green-500/50 bg-green-500/10",
};

const iconColors: Record<MindscapeNodeType, string> = {
  entity: "text-purple-400",
  concept: "text-biolum",
  note: "text-yellow-400",
  conversation: "text-blue-400",
  window: "text-orange-400",
  agent: "text-green-400",
};

type EntityNodeProps = NodeProps<Node<MindscapeNodeData>>;

export function EntityNode({ data, selected }: EntityNodeProps) {
  const nodeData = data as MindscapeNodeData;
  const Icon = typeIcons[nodeData.type] || Brain;
  const colorClass = typeColors[nodeData.type] || typeColors.entity;
  const iconColor = iconColors[nodeData.type] || iconColors.entity;

  return (
    <>
      <Handle className="!bg-biolum" position={Position.Top} type="target" />

      <div
        className={cn(
          "min-w-32 rounded-xl border-2 px-4 py-3 shadow-lg transition-all",
          colorClass,
          selected && "ring-2 ring-biolum ring-offset-2 ring-offset-void"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", iconColor)} />
          <span className="font-medium">{nodeData.label}</span>
        </div>

        {nodeData.description && (
          <p className="mt-1 text-biolum-dim text-xs">{nodeData.description}</p>
        )}
      </div>

      <Handle className="!bg-biolum" position={Position.Bottom} type="source" />
    </>
  );
}
