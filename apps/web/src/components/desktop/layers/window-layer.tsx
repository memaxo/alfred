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
import { WindowErrorBoundary } from "@/components/windows/shared/error-boundary";
import { useDesktopStore } from "@/store/desktop";
import type { WindowType } from "@/store/desktop/types.new";
import { TileZonePreview } from "../tiling/zone-preview";
import { WindowChrome } from "../windows/chrome";
import { windowRegistry, withWindowAdapter } from "../windows/registry";

type WindowLayerProps = {
  style?: CSSProperties;
  focusedWindowId: string | null;
};

export function WindowLayer({ style, focusedWindowId }: WindowLayerProps) {
  const { windows, desktopArea } = useDesktopStore(
    useShallow((s) => ({
      windows: s.windows,
      desktopArea: s.desktopArea,
    }))
  );

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
          top: desktopArea.y,
          bottom: window.innerHeight - desktopArea.y - desktopArea.height,
        }}
      >
        {/* Tile Zone Preview (shown during drag) */}
        <TileZonePreview />

        {/* Window instances (skip minimized) */}
        {windows
          .filter((w) => w.state !== "minimized")
          .map((window) => {
            const registryEntry = windowRegistry[window.type as WindowType];
            if (!registryEntry?.component) {
              return null;
            }

            // Wrap legacy components with adapter
            const Component = registryEntry.isLegacy
              ? withWindowAdapter(registryEntry.component)
              : registryEntry.component;

            return (
              <WindowChrome
                isFocused={window.id === focusedWindowId}
                key={window.id}
                windowId={window.id}
              >
                <WindowErrorBoundary windowId={window.id}>
                  <Component />
                </WindowErrorBoundary>
              </WindowChrome>
            );
          })}

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
