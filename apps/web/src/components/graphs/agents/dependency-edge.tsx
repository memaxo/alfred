"use client";

/**
 * Dependency Edge - Edge type for agent dependencies
 */

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { cn } from "@/lib/utils";

export type DependencyEdgeData = {
  type: "spawn" | "dependency" | "data";
};

const edgeStyles: Record<string, { stroke: string; dasharray?: string }> = {
  spawn: { stroke: "stroke-green-500/60" },
  dependency: { stroke: "stroke-blue-500/60", dasharray: "5 5" },
  data: { stroke: "stroke-orange-500/60", dasharray: "2 2" },
};

type DependencyEdgeProps = EdgeProps<Edge<DependencyEdgeData>>;

export function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: DependencyEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const edgeData = data as DependencyEdgeData | undefined;
  const edgeType = edgeData?.type || "spawn";
  const style = edgeStyles[edgeType];

  return (
    <>
      <BaseEdge
        className={cn(style?.stroke, selected && "!stroke-biolum")}
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: style?.dasharray,
        }}
      />

      {edgeData?.type && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded bg-void-surface/90 px-1.5 py-0.5 text-biolum-dim text-xs capitalize"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.type}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
