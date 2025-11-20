import { Position } from "@xyflow/react";
import { Maximize2, Pin, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Node,
  NodeContent,
  NodeFooter,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node";
import { Toolbar } from "@/components/ai-elements/toolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMindscapeStore } from "@/store/mindscape";

export type MindscapeNodeProps = {
  id: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  selected?: boolean;
  headerActions?: ReactNode;
  handles?: {
    source?: boolean;
    target?: boolean;
  };
};

export function MindscapeNode({
  id,
  title,
  children,
  footer,
  className,
  selected,
  headerActions,
  handles = { source: true, target: true },
}: MindscapeNodeProps) {
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);

  return (
    <Node
      aria-label={title}
      className={cn(
        "min-w-[300px] border border-white/10 bg-void-surface/40 backdrop-blur-xl transition-all duration-500 ease-fluid",
        selected &&
          "scale-[1.01] border-biolum shadow-[0_0_15px_rgba(var(--biolum-rgb),0.3)]",
        className
      )}
      handles={{
        source: handles.source ?? false,
        target: handles.target ?? false,
      }}
      role="region"
    >
      <NodeHeader className="border-white/10 bg-white/5">
        <div className="flex w-full items-center justify-between">
          <NodeTitle className="font-medium text-biolum tracking-tight">
            {title}
          </NodeTitle>
          <div className="flex items-center gap-1">{headerActions}</div>
        </div>
      </NodeHeader>

      <NodeContent className="p-0">{children}</NodeContent>

      {footer && (
        <NodeFooter className="border-white/10 border-t bg-white/5 text-biolum-dim text-xs">
          {footer}
        </NodeFooter>
      )}

      <Toolbar
        className="-translate-y-12 opacity-0 transition-opacity group-hover:opacity-100"
        position={Position.Top}
      >
        <Button
          aria-label="Pin node"
          className="h-6 w-6 hover:text-biolum"
          size="icon"
          variant="ghost"
        >
          <Pin className="h-3 w-3" />
        </Button>
        <Button
          aria-label="Maximize node"
          className="h-6 w-6 hover:text-biolum"
          size="icon"
          variant="ghost"
        >
          <Maximize2 className="h-3 w-3" />
        </Button>
        <Button
          aria-label="Close node"
          className="h-6 w-6 hover:text-red-400"
          onClick={() => removeArtifact(id)}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </Toolbar>
    </Node>
  );
}
