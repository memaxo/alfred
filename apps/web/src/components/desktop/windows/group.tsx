"use client";

import { X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

import type { ResizeDirection } from "./types";

import { ResizeHandles } from "./resize-handles";

type WindowGroupChromeProps = {
  groupId: string;
  children: (activeWindowId: string) => React.ReactNode;
};

export function WindowGroupChrome({
  groupId,
  children,
}: WindowGroupChromeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const group = useDesktopStore((s) => s.groups.find((g) => g.id === groupId));
  const desktopArea = useDesktopStore((s) => s.desktopArea);
  const setActiveTab = useDesktopStore((s) => s.setActiveTab);
  const removeFromGroup = useDesktopStore((s) => s.removeFromGroup);
  const focusGroup = useDesktopStore((s) => s.focusGroup);
  const windows = useDesktopStore(
    useShallow((s) => {
      const g = s.groups.find((g) => g.id === groupId);
      if (!g) {
        return [];
      }
      return s.windows.filter((w) => g.windowIds.includes(w.id));
    })
  );

  const handleTabClick = useCallback(
    (windowId: string) => {
      setActiveTab(groupId, windowId);
    },
    [groupId, setActiveTab]
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, windowId: string) => {
      e.stopPropagation();
      removeFromGroup(groupId, windowId);
    },
    [groupId, removeFromGroup]
  );

  const handleFocus = useCallback(() => {
    if (!group?.isFocused) {
      focusGroup(groupId);
    }
  }, [focusGroup, groupId, group?.isFocused]);

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
      const currentBounds = group?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = currentBounds.x + (moveEvent.clientX - startX);
        const newY = currentBounds.y + (moveEvent.clientY - startY);

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;

        useDesktopStore.setState((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) {
              return g;
            }
            return {
              ...g,
              bounds: {
                ...g.bounds,
                x: Math.max(
                  minX,
                  Math.min(newX, minX + maxX - currentBounds.width)
                ),
                y: Math.max(
                  minY,
                  Math.min(newY, minY + maxY - currentBounds.height)
                ),
              },
            };
          }),
        }));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleFocus, group, groupId, desktopArea]
  );

  const handleResizeStart = useCallback(
    (direction: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      handleFocus();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentBounds = group?.bounds ?? {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const { x: minX, y: minY, width: maxX, height: maxY } = desktopArea;
        const minW = 300;
        const minH = 200;

        const newBounds = { ...currentBounds };

        if (direction.includes("e")) {
          newBounds.width = Math.max(minW, currentBounds.width + deltaX);
          newBounds.width = Math.min(
            newBounds.width,
            minX + maxX - currentBounds.x
          );
        }
        if (direction.includes("w")) {
          newBounds.x = currentBounds.x + deltaX;
          newBounds.width = Math.max(minW, currentBounds.width - deltaX);
          newBounds.x = currentBounds.x + currentBounds.width - newBounds.width;
          newBounds.x = Math.max(
            minX,
            Math.min(newBounds.x, minX + maxX - newBounds.width)
          );
        }
        if (direction.includes("s")) {
          newBounds.height = Math.max(minH, currentBounds.height + deltaY);
          newBounds.height = Math.min(
            newBounds.height,
            minY + maxY - currentBounds.y
          );
        }
        if (direction.includes("n")) {
          newBounds.y = currentBounds.y + deltaY;
          newBounds.height = Math.max(minH, currentBounds.height - deltaY);
          newBounds.y =
            currentBounds.y + currentBounds.height - newBounds.height;
          newBounds.y = Math.max(
            minY,
            Math.min(newBounds.y, minY + maxY - newBounds.height)
          );
        }

        useDesktopStore.setState((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) {
              return g;
            }
            return { ...g, bounds: newBounds };
          }),
        }));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleFocus, group, groupId, desktopArea]
  );

  if (!group || windows.length === 0) {
    return null;
  }

  const bounds = group.bounds;
  const isMaximized = group.state === "maximized";

  return (
    <div
      aria-label="Window Group"
      className={cn(
        "pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border-2 bg-void-surface/95 shadow-xl backdrop-blur-xl transition-all duration-200",
        group.isFocused
          ? "border-biolum/50 shadow-[0_0_30px_rgba(0,255,136,0.2)] ring-2 ring-biolum/20 ring-offset-2 ring-offset-void"
          : "border-white/10 shadow-lg",
        isDragging && "cursor-grabbing",
        isResizing && "select-none"
      )}
      data-group-id={groupId}
      onMouseDown={handleFocus}
      ref={containerRef}
      role="tablist"
      style={{
        left: isMaximized ? desktopArea.x : bounds.x,
        top: isMaximized ? desktopArea.y : bounds.y,
        width: isMaximized ? desktopArea.width : bounds.width,
        height: isMaximized ? desktopArea.height : bounds.height,
        zIndex: group.zIndex,
      }}
    >
      <div
        className={cn(
          "flex h-10 flex-shrink-0 cursor-grab items-center gap-1 overflow-x-auto border-white/5 border-b px-2",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleDragStart}
      >
        {windows.map((w) => (
          <TabButton
            isActive={w.id === group.activeWindowId}
            key={w.id}
            label={w.data?.label ?? w.type}
            onClick={() => handleTabClick(w.id)}
            onClose={(e) => handleTabClose(e, w.id)}
          />
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {children(group.activeWindowId)}
      </div>

      {!isMaximized && <ResizeHandles onResizeStart={handleResizeStart} />}
    </div>
  );
}

type TabButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
};

function TabButton({ label, isActive, onClick, onClose }: TabButtonProps) {
  return (
    <div
      aria-selected={isActive}
      className={cn(
        "group flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs transition-all",
        isActive
          ? "bg-biolum/20 text-biolum"
          : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
      )}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      role="tab"
      tabIndex={0}
    >
      <span className="max-w-24 truncate">{label}</span>
      <button
        aria-label={`Close ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
        onClick={onClose}
        type="button"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
