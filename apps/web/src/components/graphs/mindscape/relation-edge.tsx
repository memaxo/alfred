"use client";

/**
 * Relation Edge - Custom edge type for Mindscape relations
 */

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { MindscapeEdgeData } from "@/store/mindscape";

const edgeColors: Record<string, string> = {
  relation: "stroke-biolum/60",
  reference: "stroke-blue-500/60",
  spawn: "stroke-green-500/60",
  dependency: "stroke-orange-500/60",
};

type RelationEdgeProps = EdgeProps<Edge<MindscapeEdgeData>>;

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: RelationEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as MindscapeEdgeData | undefined;
  const edgeType = edgeData?.type || "relation";
  const strokeClass = edgeColors[edgeType] || edgeColors.relation;

  return (
    <>
      <BaseEdge
        className={cn(strokeClass, selected && "!stroke-biolum")}
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 3 : 2,
        }}
      />

      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded bg-void-surface/90 px-2 py-0.5 text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
