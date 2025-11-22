import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
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
  const isActive = activeEdges.has(id);

  // Define the "living" style
  const edgeStyle = {
    ...style,
    strokeWidth: isActive ? 2 : 1,
    stroke: isActive ? "oklch(0.99 0 0)" : "rgba(255, 255, 255, 0.2)", // Biolum vs Dim
    strokeDasharray: isActive ? "5 5" : undefined,
    animation: isActive ? "flow 0.5s linear infinite" : undefined,
    transition: "stroke 0.3s, stroke-width 0.3s",
  };

  return (
    <>
      {/* Glow effect behind the edge when active */}
      {isActive && (
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            strokeWidth: 6,
            stroke: "rgba(var(--biolum-rgb), 0.3)",
            filter: "blur(4px)",
          }}
        />
      )}
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
    </>
  );
}
