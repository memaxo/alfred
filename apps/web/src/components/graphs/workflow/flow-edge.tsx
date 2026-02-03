/**
 * Flow Edge - Workflow connection edge
 */

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

export interface FlowEdgeData {
  [key: string]: unknown;
  label?: string;
  condition?: string;
}

type FlowEdgeProps = EdgeProps<Edge<FlowEdgeData>>;

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: FlowEdgeProps) {
  const edgeData = data as FlowEdgeData | undefined;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge
        className={cn("stroke-biolum/60", selected && "!stroke-biolum")}
        id={id}
        path={edgePath}
        style={{ strokeWidth: selected ? 3 : 2 }}
      />

      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "nodrag nopan pointer-events-auto absolute rounded px-2 py-0.5 font-medium text-xs",
              edgeData.label === "Yes"
                ? "bg-green-500/20 text-green-400"
                : edgeData.label === "No"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-void-surface/90 text-biolum-dim"
            )}
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
