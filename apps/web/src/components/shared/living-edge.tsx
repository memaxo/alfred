import type { EdgeProps } from "@xyflow/react";

import { BaseEdge, getSmoothStepPath } from "@xyflow/react";

export function LivingEdge({
  id: _id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const kind = data?.kind;

  let stroke = style.stroke ?? "rgba(255, 255, 255, 0.2)";
  let strokeWidth = style.strokeWidth ?? 1;
  let { strokeDasharray } = style;

  if (kind === "explains") {
    strokeDasharray = "4 2";
    strokeWidth = 1.5;
    stroke = "rgba(16, 185, 129, 0.6)";
  } else if (kind === "mentions") {
    stroke = "rgba(99, 102, 241, 0.4)";
  }

  const edgeStyle = {
    ...style,
    strokeWidth,
    stroke,
    strokeDasharray,
    transition: "stroke 0.3s, stroke-width 0.3s",
  };

  return <BaseEdge markerEnd={markerEnd} path={edgePath} style={edgeStyle} />;
}
