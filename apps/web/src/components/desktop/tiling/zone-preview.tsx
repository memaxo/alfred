"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

export function TileZonePreview() {
  const { activeTilePreview, zones } = useDesktopStore((s) => ({
    activeTilePreview: s.activeTilePreview,
    zones: s.zones,
  }));

  const zone = zones.find((z) => z.id === activeTilePreview);

  return (
    <AnimatePresence>
      {activeTilePreview && zone && (
        <motion.div
          animate={{
            left: zone.bounds.x + 8,
            top: zone.bounds.y + 8,
            width: zone.bounds.width - 16,
            height: zone.bounds.height - 16,
            opacity: 1,
            scale: 1,
          }}
          className={cn(
            "pointer-events-none absolute rounded-2xl border-2 border-biolum/40 bg-biolum/10 shadow-[0_0_50px_rgba(0,255,136,0.2)] backdrop-blur-sm"
          )}
          data-tile-preview={activeTilePreview}
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        >
          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              className="flex flex-col items-center gap-2 rounded-full bg-void-surface/60 p-4 px-6 shadow-2xl ring-1 ring-biolum/30"
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 2,
                ease: "easeInOut",
              }}
            >
              <div className="h-1.5 w-12 rounded-full bg-biolum/40" />
              <span className="font-medium text-biolum text-xs uppercase tracking-widest">
                Snap to {activeTilePreview.replace("-", " ")}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
