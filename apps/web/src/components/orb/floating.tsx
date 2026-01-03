"use client";

/**
 * Floating Orb - Draggable floating orb with position persistence
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useOrbStore } from "@/store/orb";
import { OrbCore } from "./core";
import { QuickActions } from "./quick-actions";

export function FloatingOrb() {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const position = useOrbStore((s) => s.position);
  const setPosition = useOrbStore((s) => s.setPosition);
  const expand = useOrbStore((s) => s.expand);
  const dock = useOrbStore((s) => s.dock);
  const state = useOrbStore((s) => s.state);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!(isDragging && dragRef.current)) {
        return;
      }

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      setPosition({
        x: dragRef.current.startPosX + deltaX,
        y: dragRef.current.startPosY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setPosition]);

  const handleClick = () => {
    if (!isDragging) {
      if (state === "idle") {
        setShowQuickActions(!showQuickActions);
      } else {
        expand();
      }
    }
  };

  const handleDoubleClick = () => {
    dock();
  };

  return (
    <div
      className={cn(
        "fixed z-50 cursor-grab rounded-full bg-void-surface/80 p-2 shadow-xl backdrop-blur-sm",
        isDragging && "cursor-grabbing"
      )}
      style={{
        left: position.x || 20,
        top: position.y || 20,
      }}
    >
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
      >
        <OrbCore size="lg" />
      </div>

      {/* Quick Actions Popover */}
      {showQuickActions && !isDragging && (
        <QuickActions
          className="-translate-x-1/2 absolute top-full left-1/2 mt-2"
          onClose={() => setShowQuickActions(false)}
        />
      )}

      {/* State label */}
      {state !== "idle" && (
        <div className="-bottom-6 -translate-x-1/2 absolute left-1/2 whitespace-nowrap rounded bg-void-surface/90 px-2 py-0.5 text-xs capitalize">
          {state}...
        </div>
      )}
    </div>
  );
}
