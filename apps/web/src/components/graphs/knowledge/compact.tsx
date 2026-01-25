"use client";

/**
 * Compact Knowledge Graph Visualization for Context Panel
 *
 * Lightweight SVG-based graph visualization optimized for small spaces.
 * Shows relevant nodes and their connections based on search query.
 */

import { Brain } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  relevance: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface CompactKnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const typeColors = {
  concept: "fill-blue-500/20 stroke-blue-500/50",
  person: "fill-green-500/20 stroke-green-500/50",
  project: "fill-purple-500/20 stroke-purple-500/50",
  file: "fill-orange-500/20 stroke-orange-500/50",
  note: "fill-cyan-500/20 stroke-cyan-500/50",
  fact: "fill-yellow-500/20 stroke-yellow-500/50",
  other: "fill-gray-500/20 stroke-gray-500/50",
};

const size = 400;
const center = size / 2;
const radius = 120;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CompactKnowledgeGraph({
  data,
  onNodeClick,
  className,
}: CompactKnowledgeGraphProps) {
  const { nodes, edges } = data;
  const centerNodeId = nodes[0]?.id;

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();

    if (centerNodeId) {
      positions.set(centerNodeId, { x: center, y: center });
    }

    const otherNodes = nodes.slice(1);
    const count = otherNodes.length || 1;
    otherNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / count;
      positions.set(node.id, {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      });
    });

    return positions;
  }, [centerNodeId, nodes]);

  const visibleEdges = useMemo(() => {
    const nodeIdSet = new Set(nodes.map((n) => n.id));
    return edges.filter(
      (edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
    );
  }, [edges, nodes]);

  if (nodes.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="text-center">
          <Brain className="mx-auto mb-2 h-8 w-8 text-biolum-dim" />
          <p className="text-biolum-dim text-sm">No knowledge graph data</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <svg className="h-full w-full" viewBox={`0 0 ${size} ${size}`}>
        {visibleEdges.map((edge) => {
          const source = nodePositions.get(edge.source);
          const target = nodePositions.get(edge.target);
          if (!source) {
            return null;
          }
          if (!target) {
            return null;
          }

          return (
            <line
              className="stroke-white/10"
              key={edge.id}
              strokeWidth={edge.weight}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
            />
          );
        })}

        {nodes.map((node) => {
          const position = nodePositions.get(node.id);
          if (!position) {
            return null;
          }

          const colors =
            typeColors[node.type as keyof typeof typeColors] ||
            typeColors.other;
          const isCenterNode =
            centerNodeId !== undefined && centerNodeId === node.id;
          const nodeSize = isCenterNode ? 16 : 12;

          return (
            <g key={node.id}>
              <circle
                className={cn(
                  "pointer-events-none cursor-pointer transition-colors hover:stroke-biolum",
                  colors,
                  onNodeClick ? "!pointer-events-auto" : ""
                )}
                cx={position.x}
                cy={position.y}
                fillOpacity={0.2}
                onClick={() => onNodeClick?.(node.id)}
                r={nodeSize}
                strokeOpacity={0.5}
                strokeWidth={1}
              />

              {isCenterNode && (
                <text
                  className="fill-biolum font-medium text-[10px]"
                  textAnchor="middle"
                  x={position.x}
                  y={position.y + nodeSize + 12}
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute right-2 bottom-2 flex flex-col gap-1 rounded-lg border border-white/10 bg-void-surface/80 p-2 backdrop-blur-sm">
        {nodes.slice(0, 5).map((node) => {
          const colorClass =
            typeColors[node.type as keyof typeof typeColors]?.split(" ")[2];
          return (
            <div className="flex items-center gap-2 text-[10px]" key={node.id}>
              <Brain className={cn("h-3 w-3", colorClass)} />
              <span className="max-w-20 truncate text-biolum-dim">
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
