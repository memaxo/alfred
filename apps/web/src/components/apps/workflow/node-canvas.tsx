"use client";

/**
 * Node Canvas - ReactFlow DAG canvas for workflow editing
 *
 * Note: Full ReactFlow integration comes in Phase 6
 */

import { GitBranch, GitFork, Repeat, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface NodeCanvasProps {
  className?: string;
}

// Mock workflow nodes
const mockNodes = [
  { id: "1", type: "trigger", name: "On Schedule", x: 20, y: 30 },
  { id: "2", type: "action", name: "Fetch Data", x: 20, y: 50 },
  { id: "3", type: "condition", name: "Check Status", x: 20, y: 70 },
  { id: "4", type: "action", name: "Send Alert", x: 50, y: 85 },
  { id: "5", type: "action", name: "Log Success", x: 80, y: 70 },
];

const mockEdges = [
  { source: "1", target: "2" },
  { source: "2", target: "3" },
  { source: "3", target: "4", label: "failed" },
  { source: "3", target: "5", label: "success" },
];

const nodeIcons = {
  trigger: Zap,
  action: GitBranch,
  condition: GitFork,
  loop: Repeat,
};

const nodeColors = {
  trigger: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
  action: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  condition: "bg-purple-500/20 border-purple-500/50 text-purple-400",
  loop: "bg-green-500/20 border-green-500/50 text-green-400",
};

export function NodeCanvas({ className }: NodeCanvasProps) {
  return (
    <div className={cn("relative bg-void", className)}>
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {/* SVG for edges */}
      <svg className="absolute inset-0 h-full w-full">
        {mockEdges.map((edge, idx) => {
          const source = mockNodes.find((n) => n.id === edge.source);
          const target = mockNodes.find((n) => n.id === edge.target);
          if (!(source && target)) {
            return null;
          }

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          return (
            <g key={idx}>
              <path
                className="fill-none stroke-white/30"
                d={`M ${source.x}% ${source.y}% Q ${midX}% ${source.y}% ${midX}% ${midY}% Q ${midX}% ${target.y}% ${target.x}% ${target.y}%`}
                strokeWidth="2"
              />
              {edge.label && (
                <text
                  className="fill-biolum-dim text-xs"
                  textAnchor="middle"
                  x={`${midX}%`}
                  y={`${midY}%`}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {mockNodes.map((node) => {
        const Icon = nodeIcons[node.type as keyof typeof nodeIcons];
        const colors = nodeColors[node.type as keyof typeof nodeColors];

        return (
          <div
            className={cn(
              "-translate-x-1/2 -translate-y-1/2 absolute flex cursor-move items-center gap-2 rounded-lg border px-3 py-2",
              colors
            )}
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <Icon className="h-4 w-4" />
            <span className="whitespace-nowrap text-sm">{node.name}</span>
          </div>
        );
      })}

      {/* Placeholder message */}
      <div className="absolute right-4 bottom-4 text-biolum-faint text-xs">
        Drag nodes to reposition • Full ReactFlow in Phase 6
      </div>
    </div>
  );
}
