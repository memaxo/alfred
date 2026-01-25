"use client";

/**
 * Desktop Icons - Grid of pinnable shortcuts on desktop background
 *
 * Renders a grid of application shortcuts that users can double-click to launch.
 * Icons pull metadata (icon, label) from windowRegistry.
 * Supports drag-to-reposition, click-to-select, and context menu.
 *
 * @see docs/execplans/desktop-evolution-prd.md
 */

import { MessageSquare } from "lucide-react";
import { type CSSProperties, useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { DesktopIcon } from "@/store/desktop/icons";
import type { WindowType } from "@/store/desktop/types.new";

import {
  getWindowIcon,
  getWindowLabel,
} from "@/components/desktop/windows/registry";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

const ICON_SIZE = 80;
const GRID_GAP = 8;
const GRID_PADDING = 16;

interface DesktopIconsProps {
  style?: CSSProperties;
}

export function DesktopIcons({ style }: DesktopIconsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const {
    desktopIcons,
    selectedIconIds,
    draggingIconId,
    spawnWindow,
    selectIcon,
    clearIconSelection,
    moveDesktopIcon,
    setDraggingIcon,
  } = useDesktopStore(
    useShallow((s) => ({
      desktopIcons: s.desktopIcons,
      selectedIconIds: s.selectedIconIds,
      draggingIconId: s.draggingIconId,
      spawnWindow: s.spawnWindow,
      selectIcon: s.selectIcon,
      clearIconSelection: s.clearIconSelection,
      moveDesktopIcon: s.moveDesktopIcon,
      setDraggingIcon: s.setDraggingIcon,
    }))
  );

  const handleDoubleClick = useCallback(
    (type: WindowType) => {
      spawnWindow(type);
    },
    [spawnWindow]
  );

  const handleClick = useCallback(
    (iconId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      selectIcon(iconId, e.shiftKey || e.metaKey);
    },
    [selectIcon]
  );

  const handleBackgroundClick = useCallback(() => {
    clearIconSelection();
  }, [clearIconSelection]);

  const handleDragStart = useCallback(
    (iconId: string, e: React.MouseEvent) => {
      e.preventDefault();
      setDraggingIcon(iconId);

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const relativeX = moveEvent.clientX - rect.left;
        const relativeY = moveEvent.clientY - rect.top;

        const col = Math.floor(relativeX / (ICON_SIZE + GRID_GAP));
        const row = Math.floor(relativeY / (ICON_SIZE + 20 + GRID_GAP));

        setDragPreview({ row: Math.max(0, row), col: Math.max(0, col) });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (dragPreview) {
          moveDesktopIcon(iconId, dragPreview);
        }
        setDraggingIcon(null);
        setDragPreview(null);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dragPreview, moveDesktopIcon, setDraggingIcon]
  );

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-layer="desktop-icons"
      onClick={handleBackgroundClick}
      style={{
        ...style,
        top: 32 + GRID_PADDING,
        left: GRID_PADDING,
        right: GRID_PADDING,
        bottom: 48 + GRID_PADDING,
      }}
    >
      <div
        className="relative h-full w-full"
        ref={containerRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, ${ICON_SIZE}px)`,
          gridTemplateRows: `repeat(auto-fill, ${ICON_SIZE + 20}px)`,
          gap: GRID_GAP,
          alignContent: "start",
        }}
      >
        {desktopIcons.map((icon) => (
          <DesktopIconButton
            icon={icon}
            isDragging={draggingIconId === icon.id}
            isSelected={selectedIconIds.includes(icon.id)}
            key={icon.id}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onDragStart={handleDragStart}
          />
        ))}

        {dragPreview && (
          <div
            className="pointer-events-none absolute rounded-lg border-2 border-biolum/50 border-dashed bg-biolum/10"
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE + 20,
              gridRow: dragPreview.row + 1,
              gridColumn: dragPreview.col + 1,
            }}
          />
        )}
      </div>
    </div>
  );
}

interface DesktopIconButtonProps {
  icon: DesktopIcon;
  isSelected: boolean;
  isDragging: boolean;
  onClick: (iconId: string, e: React.MouseEvent) => void;
  onDoubleClick: (type: WindowType) => void;
  onDragStart: (iconId: string, e: React.MouseEvent) => void;
}

function DesktopIconButton({
  icon,
  isSelected,
  isDragging,
  onClick,
  onDoubleClick,
  onDragStart,
}: DesktopIconButtonProps) {
  const Icon = getWindowIcon(icon.type) ?? MessageSquare;
  const label = icon.customLabel ?? getWindowLabel(icon.type);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick(icon.id, e);
    },
    [icon.id, onClick]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(icon.type);
  }, [icon.type, onDoubleClick]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        onDragStart(icon.id, e);
      }
    },
    [icon.id, onDragStart]
  );

  return (
    <button
      aria-label={`Open ${label}`}
      className={cn(
        "pointer-events-auto flex flex-col items-center justify-center gap-1 rounded-lg p-2",
        "text-biolum-dim transition-all",
        "hover:bg-white/5 hover:text-biolum",
        "focus:outline-none focus:ring-2 focus:ring-biolum/50 focus:ring-offset-2 focus:ring-offset-void",
        "active:scale-95",
        isSelected &&
          "bg-biolum/10 text-biolum ring-2 ring-biolum/50 ring-offset-2 ring-offset-void",
        isDragging && "opacity-50"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE + 20,
        gridRow: icon.position.row + 1,
        gridColumn: icon.position.col + 1,
      }}
      title={`Double-click to open ${label}`}
      type="button"
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg bg-void-surface/60 backdrop-blur-sm",
          isSelected && "bg-biolum/20"
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <span className="max-w-full truncate text-xs">{label}</span>
    </button>
  );
}

export { DesktopIconButton };
