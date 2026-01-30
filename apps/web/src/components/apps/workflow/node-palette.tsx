/**
 * Node Palette - Draggable node types
 */

import { GitBranch, GitFork, Repeat, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NodePaletteProps {
  onClose: () => void;
  className?: string;
}

const nodeTypes = [
  {
    category: "Triggers",
    nodes: [
      {
        type: "trigger",
        name: "On Schedule",
        icon: Zap,
        description: "Run on a schedule",
      },
      {
        type: "trigger",
        name: "On Webhook",
        icon: Zap,
        description: "Trigger via HTTP",
      },
      {
        type: "trigger",
        name: "On Event",
        icon: Zap,
        description: "Listen for events",
      },
    ],
  },
  {
    category: "Actions",
    nodes: [
      {
        type: "action",
        name: "HTTP Request",
        icon: GitBranch,
        description: "Make API calls",
      },
      {
        type: "action",
        name: "Run Script",
        icon: GitBranch,
        description: "Execute code",
      },
      {
        type: "action",
        name: "Send Message",
        icon: GitBranch,
        description: "Send notifications",
      },
    ],
  },
  {
    category: "Control Flow",
    nodes: [
      {
        type: "condition",
        name: "If/Else",
        icon: GitFork,
        description: "Branch logic",
      },
      {
        type: "loop",
        name: "For Each",
        icon: Repeat,
        description: "Iterate items",
      },
      {
        type: "loop",
        name: "While",
        icon: Repeat,
        description: "Loop until condition",
      },
    ],
  },
];

const typeColors = {
  trigger: "border-yellow-500/50 text-yellow-400",
  action: "border-blue-500/50 text-blue-400",
  condition: "border-purple-500/50 text-purple-400",
  loop: "border-green-500/50 text-green-400",
};

export function NodePalette({ onClose, className }: NodePaletteProps) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-sm">Nodes</span>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {nodeTypes.map((category) => (
            <div className="mb-4" key={category.category}>
              <h4 className="mb-2 px-2 font-medium text-biolum-dim text-xs uppercase tracking-wider">
                {category.category}
              </h4>
              {category.nodes.map((node) => {
                const Icon = node.icon;
                const colors = typeColors[node.type as keyof typeof typeColors];

                return (
                  <div
                    className={cn(
                      "mb-1 flex cursor-grab items-center gap-2 rounded-lg border border-white/5 bg-void-surface p-2 transition-colors hover:border-white/20 active:cursor-grabbing",
                      colors
                    )}
                    draggable
                    key={node.name}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{node.name}</div>
                      <div className="truncate text-biolum-faint text-xs">
                        {node.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
