"use client";

/**
 * Knowledge Entity Node - Custom node for knowledge entities
 */

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Brain, Calendar, Lightbulb, Link, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type KnowledgeEntityType =
  | "person"
  | "place"
  | "concept"
  | "event"
  | "fact"
  | "relation";

export type KnowledgeEntityData = {
  label: string;
  type: KnowledgeEntityType;
  description?: string;
  confidence?: number;
};

const typeIcons: Record<KnowledgeEntityType, typeof Brain> = {
  person: User,
  place: MapPin,
  concept: Lightbulb,
  event: Calendar,
  fact: Brain,
  relation: Link,
};

const typeColors: Record<KnowledgeEntityType, string> = {
  person: "border-blue-500/50 bg-blue-500/10",
  place: "border-green-500/50 bg-green-500/10",
  concept: "border-biolum/50 bg-biolum/10",
  event: "border-orange-500/50 bg-orange-500/10",
  fact: "border-purple-500/50 bg-purple-500/10",
  relation: "border-yellow-500/50 bg-yellow-500/10",
};

const iconColors: Record<KnowledgeEntityType, string> = {
  person: "text-blue-400",
  place: "text-green-400",
  concept: "text-biolum",
  event: "text-orange-400",
  fact: "text-purple-400",
  relation: "text-yellow-400",
};

type KnowledgeEntityNodeProps = NodeProps<Node<KnowledgeEntityData>>;

export function KnowledgeEntityNode({
  data,
  selected,
}: KnowledgeEntityNodeProps) {
  const nodeData = data as KnowledgeEntityData;
  const Icon = typeIcons[nodeData.type] || Brain;
  const colorClass = typeColors[nodeData.type] || typeColors.concept;
  const iconColor = iconColors[nodeData.type] || iconColors.concept;

  return (
    <>
      <Handle className="!bg-biolum" position={Position.Top} type="target" />

      <div
        className={cn(
          "min-w-28 rounded-lg border-2 px-3 py-2 shadow-lg transition-all",
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

        {nodeData.confidence !== undefined && (
          <div className="mt-1 h-1 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-biolum/60"
              style={{ width: `${nodeData.confidence * 100}%` }}
            />
          </div>
        )}
      </div>

      <Handle className="!bg-biolum" position={Position.Bottom} type="source" />
    </>
  );
}
