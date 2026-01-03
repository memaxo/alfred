"use client";

/**
 * Window Layer - Traditional DOM-based window rendering
 *
 * Renders all windows using traditional DOM elements (not ReactFlow).
 * Supports tiling and floating layouts with z-index stacking.
 *
 * @see docs/execplans/desktop-type-migration.md
 */

import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDesktopStore } from "@/store/desktop";
import { TileZonePreview } from "../tiling/zone-preview";
import { WindowChrome } from "../windows/chrome";

type WindowLayerProps = {
  style?: CSSProperties;
  focusedWindowId: string | null;
};

export function WindowLayer({ style, focusedWindowId }: WindowLayerProps) {
  const { windows } = useDesktopStore(
    useShallow((s) => ({
      windows: s.windows,
    }))
  );

  // During migration, we render both old ReactFlow windows and new DOM windows
  // For now, just show a placeholder

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-layer="windows"
      style={style}
    >
      {/* Desktop area (excludes menu bar and taskbar) */}
      <div
        className="absolute right-0 left-0"
        style={{
          top: 32, // Menu bar height
          bottom: 48, // Taskbar height
        }}
      >
        {/* Tile Zone Preview (shown during drag) */}
        <TileZonePreview />

        {/* Window instances */}
        {windows.map((window) => (
          <WindowChrome
            isFocused={window.id === focusedWindowId}
            key={window.id}
            windowId={window.id}
          />
        ))}

        {/* Empty state */}
        {windows.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-biolum-dim">
              <p className="font-medium text-lg">Welcome to ALFRED</p>
              <p className="mt-1 text-sm">
                Press{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5">⌘K</kbd> to
                open command palette
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
