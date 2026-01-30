/**
 * Fact Edge - Custom edge for knowledge facts
 */

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

export interface FactEdgeData extends Record<string, unknown> {
  predicate: string;
  confidence: number;
}

type FactEdgeProps = EdgeProps<Edge<FactEdgeData>>;

export function FactEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: FactEdgeProps) {
  const edgeData = data as FactEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const opacity = edgeData?.confidence ?? 0.8;

  return (
    <>
      <BaseEdge
        className={cn(
          "stroke-biolum/60",
          selected && "!stroke-biolum !opacity-100"
        )}
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 3 : 2,
          opacity,
        }}
      />

      {edgeData?.predicate && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded bg-void-surface/90 px-2 py-0.5 text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span className="text-biolum-dim">{edgeData.predicate}</span>
            {edgeData.confidence && (
              <span className="ml-1 text-biolum/60">
                {(edgeData.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
