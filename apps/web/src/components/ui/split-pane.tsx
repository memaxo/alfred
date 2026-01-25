import { GripVertical } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: "horizontal" | "vertical";
  defaultSplit?: string | number;
  minSize?: number | [number, number];
  className?: string;
  onSplitChange?: (split: number) => void;
}

export function SplitPane({
  children,
  direction = "horizontal",
  defaultSplit = "50%",
  minSize = 100,
  className,
  onSplitChange,
}: SplitPaneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [split, setSplit] = React.useState(defaultSplit);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isHorizontal = direction === "horizontal";

  const getSplitPercentage = React.useCallback(
    (clientX: number, clientY: number): number => {
      const container = containerRef.current;
      if (!container) {
        return 50;
      }

      const rect = container.getBoundingClientRect();
      const totalSize = isHorizontal ? rect.width : rect.height;
      const position = isHorizontal ? clientX - rect.left : clientY - rect.top;

      const percentage = (position / totalSize) * 100;

      const firstMinSize = Array.isArray(minSize)
        ? (minSize[0] ?? 100)
        : minSize;
      const secondMinSize = Array.isArray(minSize)
        ? (minSize[1] ?? 100)
        : minSize;

      const minPercentage = (firstMinSize / totalSize) * 100;
      const maxPercentage = 100 - (secondMinSize / totalSize) * 100;

      return Math.max(minPercentage, Math.min(maxPercentage, percentage));
    },
    [isHorizontal, minSize]
  );

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!(isDragging && containerRef.current)) {
        return;
      }

      const newSplit = getSplitPercentage(e.clientX, e.clientY);
      setSplit(`${newSplit}%`);
      onSplitChange?.(newSplit);
    },
    [isDragging, getSplitPercentage, onSplitChange]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp, isHorizontal]);

  const firstPaneStyle: React.CSSProperties = isHorizontal
    ? { width: split, height: "100%" }
    : { width: "100%", height: split };

  const secondPaneStyle: React.CSSProperties = isHorizontal
    ? { width: `calc(100% - ${split})`, height: "100%" }
    : { width: "100%", height: `calc(100% - ${split})` };

  const resizerStyle: React.CSSProperties = isHorizontal
    ? { width: "4px", height: "100%", cursor: "col-resize" }
    : { width: "100%", height: "4px", cursor: "row-resize" };

  return (
    <div
      className={cn("flex h-full w-full", className)}
      ref={containerRef}
      style={
        isHorizontal ? { flexDirection: "row" } : { flexDirection: "column" }
      }
    >
      <div className="flex-shrink-0 overflow-hidden" style={firstPaneStyle}>
        {children[0]}
      </div>

      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center bg-void-surface/30 transition-colors hover:bg-void-surface/50",
          isDragging && "bg-biolum/30"
        )}
        onMouseDown={handleMouseDown}
        style={resizerStyle}
      >
        <GripVertical className="h-4 w-4 text-biolum-faint" />
      </div>

      <div className="flex-shrink-0 overflow-hidden" style={secondPaneStyle}>
        {children[1]}
      </div>
    </div>
  );
}
