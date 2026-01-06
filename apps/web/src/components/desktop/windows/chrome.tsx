"use client";

import { Maximize2, Minus, Square, X } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { TileZone, WindowInstance } from "@/store/desktop/types.new";
import { ResizeHandles } from "./resize-handles";
import type { ResizeDirection } from "./types";

type WindowChromeProps = {
  windowId: string;
  isFocused: boolean;
  children?: ReactNode;
};

export function WindowChrome({
  windowId,
  isFocused,
  children,
}: WindowChromeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const {
    window,
    removeWindow,
    focusWindow,
    moveWindow,
    setBounds,
    desktopArea,
    showTilePreview,
    hideTilePreview,
    tileWindow,
  } = useDesktopStore(
    useShallow((s) => ({
      window: s.windows.find((w) => w.id === windowId) as
        | WindowInstance
        | undefined,
      removeWindow: s.removeWindow,
      focusWindow: s.focusWindow,
      moveWindow: s.moveWindow,
      setBounds: s.setBounds,
      desktopArea: s.desktopArea,
      showTilePreview: s.showTilePreview,
      hideTilePreview: s.hideTilePreview,
      tileWindow: s.tileWindow,
    }))
  );

  const handleClose = useCallback(() => {
    removeWindow(windowId);
  }, [removeWindow, windowId]);

  const handleMinimize = useCallback(() => {
    useDesktopStore.getState().minimizeWindow(windowId);
  }, [windowId]);

  const handleMaximize = useCallback(() => {
    if (!window) {
      return;
    }
    if (window.state === "maximized") {
      useDesktopStore.getState().restoreWindow(windowId);
    } else {
      useDesktopStore.getState().maximizeWindow(windowId);
    }
  }, [window, windowId]);

  const handleFocus = useCallback(() => {
    if (!isFocused) {
      focusWindow(windowId);
    }
  }, [focusWindow, windowId, isFocused]);

  const detectZoneFromPosition = useCallback(
    (x: number, y: number): TileZone | null => {
      const { width, height } = desktopArea;
      const relativeX = x - desktopArea.x;
      const relativeY = y - desktopArea.y;

      if (relativeX < width * 0.3 && relativeY < height * 0.3) {
        return "top-left";
      }
      if (relativeX > width * 0.7 && relativeY < height * 0.3) {
        return "top-right";
      }
      if (relativeX < width * 0.3 && relativeY > height * 0.7) {
        return "bottom-left";
      }
      if (relativeX > width * 0.7 && relativeY > height * 0.7) {
        return "bottom-right";
      }
      if (relativeX < width * 0.5) {
        return "left";
      }
      if (relativeX > width * 0.5) {
        return "right";
      }
      if (relativeY < height * 0.5) {
        return "top";
      }
      return "bottom";
    },
    [desktopArea]
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentBounds = window?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = currentBounds.x + (moveEvent.clientX - startX);
        const newY = currentBounds.y + (moveEvent.clientY - startY);

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;

        moveWindow(windowId, {
          x: Math.max(minX, Math.min(newX, minX + maxX - currentBounds.width)),
          y: Math.max(minY, Math.min(newY, minY + maxY - currentBounds.height)),
        });

        const zone = detectZoneFromPosition(
          moveEvent.clientX,
          moveEvent.clientY
        );
        if (zone) {
          showTilePreview(zone);
        } else {
          hideTilePreview();
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        setIsDragging(false);
        hideTilePreview();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        const zone = detectZoneFromPosition(upEvent.clientX, upEvent.clientY);
        if (zone) {
          tileWindow(windowId, zone);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      handleFocus,
      window,
      windowId,
      moveWindow,
      detectZoneFromPosition,
      showTilePreview,
      hideTilePreview,
      tileWindow,
    ]
  );

  const handleResizeStart = useCallback(
    (direction: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentBounds = window?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;
        const minW = window?.minSize.width ?? 200;
        const minH = window?.minSize.height ?? 150;
        const maxW = window?.maxSize?.width ?? Number.POSITIVE_INFINITY;
        const maxH = window?.maxSize?.height ?? Number.POSITIVE_INFINITY;

        const newBounds = { ...currentBounds };

        switch (direction) {
          case "n":
            newBounds.y = currentBounds.y + deltaY;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            break;
          case "s":
            newBounds.height = currentBounds.height + deltaY;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
          case "e":
            newBounds.width = currentBounds.width + deltaX;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            break;
          case "w":
            newBounds.x = currentBounds.x + deltaX;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            break;
          case "ne":
            newBounds.y = currentBounds.y + deltaY;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.width = currentBounds.width + deltaX;
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            break;
          case "nw":
            newBounds.x = currentBounds.x + deltaX;
            newBounds.y = currentBounds.y + deltaY;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.height = currentBounds.height - deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.y =
              currentBounds.y + currentBounds.height - newBounds.height;
            newBounds.y = Math.max(
              minY,
              Math.min(newBounds.y, minY + maxY - newBounds.height)
            );
            break;
          case "se":
            newBounds.width = currentBounds.width + deltaX;
            newBounds.height = currentBounds.height + deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.width = Math.min(
              newBounds.width,
              minX + maxX - currentBounds.x
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
          case "sw":
            newBounds.x = currentBounds.x + deltaX;
            newBounds.width = currentBounds.width - deltaX;
            newBounds.height = currentBounds.height + deltaY;
            newBounds.width = Math.max(minW, Math.min(newBounds.width, maxW));
            newBounds.x =
              currentBounds.x + currentBounds.width - newBounds.width;
            newBounds.x = Math.max(
              minX,
              Math.min(newBounds.x, minX + maxX - newBounds.width)
            );
            newBounds.height = Math.max(minH, Math.min(newBounds.height, maxH));
            newBounds.height = Math.min(
              newBounds.height,
              minY + maxY - currentBounds.y
            );
            break;
        }

        setBounds(windowId, newBounds);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleFocus, window, windowId, setBounds, desktopArea]
  );

  if (!window) {
    return null;
  }

  // Validate bounds before rendering to prevent crashes
  const bounds = window.bounds ?? {
    x: 100,
    y: 100,
    width: 400,
    height: 300,
  };

  const title = window.data?.label ?? window.data?.type ?? "Window";
  const isMaximized = window.state === "maximized";

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
        left: isMaximized ? desktopArea.x : bounds.x,
        top: isMaximized ? desktopArea.y : bounds.y,
        width: isMaximized ? desktopArea.width : bounds.width,
        height: isMaximized ? desktopArea.height : bounds.height,
        zIndex: isFocused ? 500 : 100,
      }}
    >
      <div
        className={cn(
          "flex h-10 flex-shrink-0 cursor-grab items-center justify-between border-white/5 border-b px-3",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleDragStart}
      >
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

        <span className="-translate-x-1/2 pointer-events-none absolute left-1/2 font-medium text-biolum text-sm">
          {title}
        </span>

        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-auto">
        {children ?? (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            <p className="text-sm">Window content</p>
          </div>
        )}
      </div>

      {!isMaximized && <ResizeHandles onResizeStart={handleResizeStart} />}
    </div>
  );
}
