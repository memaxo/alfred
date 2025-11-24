import { BaseEdge, type EdgeProps, getSmoothStepPath } from "@xyflow/react";
import { useMindscapeStore } from "@/store/mindscape";

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
}: EdgeProps) {
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

  // Define the "living" style
  let stroke = style.stroke ?? "rgba(255, 255, 255, 0.2)";
  let strokeWidth = style.strokeWidth ?? 1;
  let animation = style.animation;
  let strokeDasharray = style.strokeDasharray;

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
