"use client";

/**
 * Tile Zone Preview - Visual indicator for tiling during drag
 *
 * Shows where a window will be tiled when dropped.
 */

import { cn } from "@/lib/utils";
// import { useDesktopStore } from "@/store/desktop"; // Will use new TilingSlice

export function TileZonePreview() {
  // This will use the new TilingSlice from Phase 0
  // For now, return null as we haven't wired up the new store yet
  const activeTilePreview = null; // Will come from tilingSlice.activeTilePreview

  if (!activeTilePreview) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-xl border-2 border-biolum/50 bg-biolum/10 transition-all duration-150"
      )}
      data-tile-preview={activeTilePreview}
      style={
        {
          // Position based on zone bounds
          // Will be calculated from tilingSlice.zones
        }
      }
    >
      <div className="flex h-full items-center justify-center">
        <span className="font-medium text-biolum/70 text-sm">
          Drop to tile here
        </span>
      </div>
    </div>
  );
}
