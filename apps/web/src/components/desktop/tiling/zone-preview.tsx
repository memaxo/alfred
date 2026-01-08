"use client";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

export function TileZonePreview() {
  const { activeTilePreview, zones } = useDesktopStore((s) => ({
    activeTilePreview: s.activeTilePreview,
    zones: s.zones,
  }));

  if (!activeTilePreview) {
    return null;
  }

  const zone = zones.find((z) => z.id === activeTilePreview);
  if (!zone) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-xl border-2 border-biolum/50 bg-biolum/10 transition-all duration-150"
      )}
      data-tile-preview={activeTilePreview}
      style={{
        left: zone.bounds.x,
        top: zone.bounds.y,
        width: zone.bounds.width,
        height: zone.bounds.height,
      }}
    >
      <div className="flex h-full items-center justify-center">
        <span className="font-medium text-biolum/70 text-sm">
          Drop to tile here
        </span>
      </div>
    </div>
  );
}
