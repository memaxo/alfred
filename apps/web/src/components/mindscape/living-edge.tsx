import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, getSmoothStepPath } from "@xyflow/react";
import { useMindscapeStore } from "@/store/mindscape";

type MindscapeEdgeProps = EdgeProps;

export function LivingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data, // Now typed via MindscapeEdgeProps
}: MindscapeEdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const activeEdges = useMindscapeStore((state) => state.activeEdges);
  const highlightedEdgeIds = useMindscapeStore(
    (state) => state.highlightedEdgeIds
  );
  const isActive = activeEdges.has(id);
  const isHighlighted = highlightedEdgeIds.has(id);

  // Use edge data for dynamic styling
  const kind = data?.kind;
  
  // Define the "living" style
  let stroke = style.stroke ?? "rgba(255, 255, 255, 0.2)";
  let strokeWidth = style.strokeWidth ?? 1;
  let animation = style.animation;
  let strokeDasharray = style.strokeDasharray;

  // Style based on kind
  if (kind === "explains") {
    strokeDasharray = "4 2";
    strokeWidth = 1.5;
    stroke = "rgba(16, 185, 129, 0.6)"; // Emerald-500
  } else if (kind === "mentions") {
    stroke = "rgba(99, 102, 241, 0.4)"; // Indigo-500
  }

  if (isHighlighted) {
    stroke = "#818cf8"; // Indigo-400
    strokeWidth = 1.5;
    // Use existing 'flow' animation but slower for context trace
    animation = "flow 2s linear infinite";
    strokeDasharray = "5 5";
  }

  if (isActive) {
    stroke = "var(--color-biolum)";
    strokeWidth = 2;
    animation = "flow 0.5s linear infinite";
    strokeDasharray = "5 5";
  }

  const edgeStyle = {
    ...style,
    strokeWidth,
    stroke,
    strokeDasharray,
    animation,
    transition: "stroke 0.3s, stroke-width 0.3s",
  };

  return (
    <>
      {/* Glow effect behind the edge when active or highlighted */}
      {(isActive || isHighlighted) && (
        <BaseEdge
          markerEnd={markerEnd}
          path={edgePath}
          style={{
            ...style,
            strokeWidth: isActive ? 6 : 4,
            stroke: isActive
              ? "oklch(0.99 0 0 / 0.3)"
              : "rgba(129, 140, 248, 0.3)", // White glow or Indigo glow
            filter: "blur(4px)",
          }}
        />
      )}
      <BaseEdge markerEnd={markerEnd} path={edgePath} style={edgeStyle} />
    </>
  );
}
