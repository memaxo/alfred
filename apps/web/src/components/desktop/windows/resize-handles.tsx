"use client";

/**
 * Resize Handles - Window resize interaction
 *
 * Provides 8 resize handles for window resizing:
 * N, S, E, W, NE, NW, SE, SW
 */

import { cn } from "@/lib/utils";

import type { ResizeDirection } from "./types";

type ResizeHandlesProps = {
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent) => void;
};

const handles: Array<{
  direction: ResizeDirection;
  className: string;
  cursor: string;
}> = [
  // Edges
  {
    direction: "n",
    className: "left-2 right-2 top-0 h-1 -translate-y-1/2",
    cursor: "ns-resize",
  },
  {
    direction: "s",
    className: "left-2 right-2 bottom-0 h-1 translate-y-1/2",
    cursor: "ns-resize",
  },
  {
    direction: "e",
    className: "top-2 bottom-2 right-0 w-1 translate-x-1/2",
    cursor: "ew-resize",
  },
  {
    direction: "w",
    className: "top-2 bottom-2 left-0 w-1 -translate-x-1/2",
    cursor: "ew-resize",
  },
  // Corners
  {
    direction: "nw",
    className: "left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2",
    cursor: "nwse-resize",
  },
  {
    direction: "ne",
    className: "right-0 top-0 h-3 w-3 translate-x-1/2 -translate-y-1/2",
    cursor: "nesw-resize",
  },
  {
    direction: "sw",
    className: "left-0 bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/2",
    cursor: "nesw-resize",
  },
  {
    direction: "se",
    className: "right-0 bottom-0 h-3 w-3 translate-x-1/2 translate-y-1/2",
    cursor: "nwse-resize",
  },
];

export function ResizeHandles({ onResizeStart }: ResizeHandlesProps) {
  return (
    <>
      {handles.map(({ direction, className, cursor }) => (
        <div
          className={cn(
            "absolute z-50 opacity-0 transition-opacity hover:opacity-100",
            className
          )}
          data-resize-handle={direction}
          key={direction}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(direction, e);
          }}
          style={{ cursor }}
        >
          {/* Visual indicator for corners */}
          {direction.length === 2 && (
            <div className="h-full w-full rounded-sm bg-biolum/20" />
          )}
        </div>
      ))}
    </>
  );
}
