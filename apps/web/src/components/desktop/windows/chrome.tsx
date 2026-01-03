"use client";

/**
 * Window Chrome - Traditional DOM-based window decoration
 *
 * Provides JARVIS-aesthetic window frame with:
 * - Title bar with window controls
 * - Resize handles (8 directions)
 * - Drag support
 * - Focus/blur states
 *
 * This replaces the ReactFlow-based window frame during migration.
 *
 * @see docs/execplans/desktop-type-migration.md Section 6.1
 */

import { Maximize2, Minus, Square, X } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import { ResizeHandles } from "./resize-handles";
import type { ResizeDirection } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type WindowChromeProps = {
  windowId: string;
  isFocused: boolean;
  children?: ReactNode;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function WindowChrome({
  windowId,
  isFocused,
  children,
}: WindowChromeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const { window, removeWindow, updateWindow, focusWindow } = useDesktopStore(
    useShallow((s) => ({
      window: s.windows.find((w) => w.id === windowId),
      removeWindow: s.removeWindow,
      updateWindow: s.updateWindow,
      focusWindow: s.focusWindow,
    }))
  );

  // Handle close
  const handleClose = useCallback(() => {
    removeWindow(windowId);
  }, [removeWindow, windowId]);

  // Handle minimize (placeholder - will be implemented properly)
  const handleMinimize = useCallback(() => {
    // For now, just update viewMode
    updateWindow(windowId, { viewMode: "compact" });
  }, [updateWindow, windowId]);

  // Handle maximize toggle
  const handleMaximize = useCallback(() => {
    const isMaximized = window?.data?.viewMode === "maximized";
    updateWindow(windowId, {
      viewMode: isMaximized ? "full" : "maximized",
    });
  }, [updateWindow, windowId, window?.data?.viewMode]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (!isFocused) {
      focusWindow(windowId);
    }
  }, [focusWindow, windowId, isFocused]);

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) {
        return; // Only drag from title bar
      }
      e.preventDefault();
      setIsDragging(true);
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentPos = window?.position ?? { x: 100, y: 100 };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = currentPos.x + (moveEvent.clientX - startX);
        const newY = currentPos.y + (moveEvent.clientY - startY);

        // Update window position (this uses old store API during migration)
        // Will be updated to use new API with setBounds
        // For now, position updates happen via ReactFlow in the old canvas
        void newX;
        void newY;
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleFocus, window?.position]
  );

  // Handle resize
  const handleResizeStart = useCallback(
    (_direction: ResizeDirection) => {
      setIsResizing(true);
      handleFocus();

      // Resize logic will be implemented here using the direction
      // Direction tells us which edge/corner is being dragged
      // For now, just set state

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleFocus]
  );

  if (!window) {
    return null;
  }

  const title = window.data?.label ?? window.data?.type ?? "Window";
  const isMaximized = window.data?.viewMode === "maximized";

  // For now, use fixed positioning based on ReactFlow node position
  // This will be replaced with proper bounds from new WindowInstance
  const position = window.position ?? { x: 100, y: 100 };

  return (
    <div
      className={cn(
        "pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border bg-void-surface/95 shadow-xl backdrop-blur-xl transition-all duration-200",
        isFocused
          ? "border-biolum/30 shadow-[0_0_30px_rgba(0,255,136,0.15)]"
          : "border-white/10 shadow-lg",
        isDragging && "cursor-grabbing",
        isResizing && "select-none"
      )}
      data-window-id={windowId}
      onMouseDown={handleFocus}
      ref={containerRef}
      style={{
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 0 : position.y,
        width: isMaximized ? "100%" : 500,
        height: isMaximized ? "100%" : 400,
        zIndex: isFocused ? 500 : 100,
      }}
    >
      {/* Title Bar */}
      <div
        className={cn(
          "flex h-10 flex-shrink-0 cursor-grab items-center justify-between border-white/5 border-b px-3",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleDragStart}
      >
        {/* Traffic lights (macOS style) */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Close"
            className="group flex h-3 w-3 items-center justify-center rounded-full bg-red-500/80 transition-colors hover:bg-red-500"
            onClick={handleClose}
            type="button"
          >
            <X className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            aria-label="Minimize"
            className="group flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500/80 transition-colors hover:bg-yellow-500"
            onClick={handleMinimize}
            type="button"
          >
            <Minus className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            aria-label={isMaximized ? "Restore" : "Maximize"}
            className="group flex h-3 w-3 items-center justify-center rounded-full bg-green-500/80 transition-colors hover:bg-green-500"
            onClick={handleMaximize}
            type="button"
          >
            {isMaximized ? (
              <Square className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100" />
            ) : (
              <Maximize2 className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </button>
        </div>

        {/* Title */}
        <span className="-translate-x-1/2 pointer-events-none absolute left-1/2 font-medium text-biolum text-sm">
          {title}
        </span>

        {/* Spacer for symmetry */}
        <div className="w-16" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {children ?? (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            <p className="text-sm">Window content</p>
          </div>
        )}
      </div>

      {/* Resize Handles */}
      {!isMaximized && <ResizeHandles onResizeStart={handleResizeStart} />}
    </div>
  );
}
