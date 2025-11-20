import { Node, NodeHeader, NodeTitle, NodeContent, NodeFooter } from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/ai-elements/toolbar";
import type { ReactNode } from "react";
import { X, Maximize2, Pin } from "lucide-react";
import { useMindscapeStore } from "@/store/mindscape";
import { Position } from "@xyflow/react";

export interface MindscapeNodeProps {
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
}

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
      handles={{
        source: handles.source ?? false,
        target: handles.target ?? false,
      }}
      role="region"
      className={cn(
        "min-w-[300px] border border-white/10 bg-void-surface/40 backdrop-blur-xl transition-all duration-500 ease-fluid",
        selected && "border-biolum shadow-[0_0_15px_rgba(var(--biolum-rgb),0.3)] scale-[1.01]",
        className
      )}
    >
      <NodeHeader className="border-white/10 bg-white/5">
        <div className="flex items-center justify-between w-full">
          <NodeTitle className="text-biolum font-medium tracking-tight">{title}</NodeTitle>
          <div className="flex items-center gap-1">
            {headerActions}
          </div>
        </div>
      </NodeHeader>
      
      <NodeContent className="p-0">
        {children}
      </NodeContent>

      {footer && (
        <NodeFooter className="border-t border-white/10 bg-white/5 text-xs text-biolum-dim">
          {footer}
        </NodeFooter>
      )}

      <Toolbar position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-y-12">
        <Button aria-label="Pin node" size="icon" variant="ghost" className="h-6 w-6 hover:text-biolum">
          <Pin className="h-3 w-3" />
        </Button>
        <Button aria-label="Maximize node" size="icon" variant="ghost" className="h-6 w-6 hover:text-biolum">
          <Maximize2 className="h-3 w-3" />
        </Button>
        <Button 
          aria-label="Close node"
          size="icon" 
          variant="ghost" 
          className="h-6 w-6 hover:text-red-400"
          onClick={() => removeArtifact(id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </Toolbar>
    </Node>
  );
}

