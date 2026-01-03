"use client";

/**
 * Graph Canvas - Force-directed graph visualization
 *
 * Note: Full ReactFlow integration comes in Phase 6
 */

import { Brain, Calendar, FileText, GitBranch, User } from "lucide-react";
import { cn } from "@/lib/utils";

type GraphCanvasProps = {
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  className?: string;
};

// Mock entities for visualization
const mockEntities = [
  { id: "1", name: "ALFRED", type: "project", x: 50, y: 50 },
  { id: "2", name: "Desktop Shell", type: "concept", x: 30, y: 30 },
  { id: "3", name: "Window Manager", type: "concept", x: 70, y: 35 },
  { id: "4", name: "ReactFlow", type: "concept", x: 25, y: 60 },
  { id: "5", name: "Tiling", type: "concept", x: 75, y: 65 },
  { id: "6", name: "Jack", type: "person", x: 50, y: 80 },
];

const mockEdges = [
  { source: "1", target: "2" },
  { source: "1", target: "3" },
  { source: "2", target: "4" },
  { source: "3", target: "5" },
  { source: "6", target: "1" },
];

const typeIcons = {
  concept: Brain,
  person: User,
  project: GitBranch,
  file: FileText,
  event: Calendar,
};

const typeColors = {
  concept: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  person: "bg-green-500/20 border-green-500/50 text-green-400",
  project: "bg-purple-500/20 border-purple-500/50 text-purple-400",
  file: "bg-orange-500/20 border-orange-500/50 text-orange-400",
  event: "bg-pink-500/20 border-pink-500/50 text-pink-400",
};

export function GraphCanvas({
  selectedEntityId,
  onSelectEntity,
  className,
}: GraphCanvasProps) {
  return (
    <div className={cn("relative bg-void", className)}>
      {/* SVG for edges */}
      <svg className="absolute inset-0 h-full w-full">
        {mockEdges.map((edge, idx) => {
          const source = mockEntities.find((e) => e.id === edge.source);
          const target = mockEntities.find((e) => e.id === edge.target);
          if (!(source && target)) {
            return null;
          }

          return (
            <line
              className="stroke-white/10"
              key={idx}
              strokeWidth="1"
              x1={`${source.x}%`}
              x2={`${target.x}%`}
              y1={`${source.y}%`}
              y2={`${target.y}%`}
            />
          );
        })}
      </svg>

      {/* Entity nodes */}
      {mockEntities.map((entity) => {
        const Icon = typeIcons[entity.type as keyof typeof typeIcons] || Brain;
        const colors = typeColors[entity.type as keyof typeof typeColors];
        const isSelected = entity.id === selectedEntityId;

        return (
          <button
            className={cn(
              "-translate-x-1/2 -translate-y-1/2 absolute flex flex-col items-center gap-1 rounded-lg border p-2 transition-all",
              colors,
              isSelected && "ring-2 ring-biolum ring-offset-2 ring-offset-void"
            )}
            key={entity.id}
            onClick={() => onSelectEntity(entity.id)}
            style={{ left: `${entity.x}%`, top: `${entity.y}%` }}
            type="button"
          >
            <Icon className="h-5 w-5" />
            <span className="whitespace-nowrap text-xs">{entity.name}</span>
          </button>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg border border-white/10 bg-void-surface p-2">
        {Object.entries(typeColors).map(([type, colors]) => {
          const Icon = typeIcons[type as keyof typeof typeIcons];
          return (
            <div className="flex items-center gap-2 text-xs" key={type}>
              <Icon className={cn("h-3 w-3", colors.split(" ")[2])} />
              <span className="text-biolum-dim capitalize">{type}</span>
            </div>
          );
        })}
      </div>

      {/* Placeholder message */}
      <div className="absolute right-4 bottom-4 text-biolum-faint text-xs">
        Full ReactFlow integration in Phase 6
      </div>
    </div>
  );
}
