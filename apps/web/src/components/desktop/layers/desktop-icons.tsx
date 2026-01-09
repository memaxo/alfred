"use client";

/**
 * Desktop Icons - Grid of pinnable shortcuts on desktop background
 *
 * Renders a grid of application shortcuts that users can double-click to launch.
 * Icons pull metadata (icon, label) from windowRegistry.
 *
 * @see docs/execplans/desktop-evolution-prd.md
 */

import { MessageSquare } from "lucide-react";
import { type CSSProperties, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getWindowIcon,
  getWindowLabel,
} from "@/components/desktop/windows/registry";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { DesktopIcon } from "@/store/desktop/icons";
import type { WindowType } from "@/store/desktop/types.new";

const ICON_SIZE = 80;
const GRID_GAP = 8;
const GRID_PADDING = 16;

type DesktopIconsProps = {
  style?: CSSProperties;
};

export function DesktopIcons({ style }: DesktopIconsProps) {
  const { desktopIcons, spawnWindow } = useDesktopStore(
    useShallow((s) => ({
      desktopIcons: s.desktopIcons,
      spawnWindow: s.spawnWindow,
    }))
  );

  const handleDoubleClick = useCallback(
    (type: WindowType) => {
      spawnWindow(type);
    },
    [spawnWindow]
  );

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-layer="desktop-icons"
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
            key={icon.id}
            onDoubleClick={handleDoubleClick}
          />
        ))}
      </div>
    </div>
  );
}

type DesktopIconButtonProps = {
  icon: DesktopIcon;
  onDoubleClick: (type: WindowType) => void;
};

function DesktopIconButton({ icon, onDoubleClick }: DesktopIconButtonProps) {
  const Icon = getWindowIcon(icon.type) ?? MessageSquare;
  const label = icon.customLabel ?? getWindowLabel(icon.type);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(icon.type);
  }, [icon.type, onDoubleClick]);

  return (
    <button
      aria-label={`Open ${label}`}
      className={cn(
        "pointer-events-auto flex flex-col items-center justify-center gap-1 rounded-lg p-2",
        "text-biolum-dim transition-all",
        "hover:bg-white/5 hover:text-biolum",
        "focus:outline-none focus:ring-2 focus:ring-biolum/50 focus:ring-offset-2 focus:ring-offset-void",
        "active:scale-95"
      )}
      onDoubleClick={handleDoubleClick}
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE + 20,
        gridRow: icon.position.row + 1,
        gridColumn: icon.position.col + 1,
      }}
      title={`Double-click to open ${label}`}
      type="button"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-void-surface/60 backdrop-blur-sm">
        <Icon className="h-6 w-6" />
      </div>
      <span className="max-w-full truncate text-xs">{label}</span>
    </button>
  );
}

export { DesktopIconButton };
