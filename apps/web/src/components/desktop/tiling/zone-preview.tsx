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
        "pointer-events-none absolute animate-pulse rounded-2xl border-2 border-biolum/40 bg-biolum/5 shadow-[0_0_30px_rgba(0,255,136,0.1)] backdrop-blur-[2px] transition-all duration-300 ease-out"
      )}
      data-tile-preview={activeTilePreview}
      style={{
        left: zone.bounds.x + 8,
        top: zone.bounds.y + 8,
        width: zone.bounds.width - 16,
        height: zone.bounds.height - 16,
      }}
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 rounded-full bg-void-surface/40 p-4 px-6 ring-1 ring-biolum/20">
          <div className="h-1.5 w-12 rounded-full bg-biolum/40" />
          <span className="font-medium text-biolum/80 text-xs uppercase tracking-widest">
            Snap to {activeTilePreview.replace("-", " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
