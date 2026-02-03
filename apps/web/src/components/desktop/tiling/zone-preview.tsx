import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

export function TileZonePreview() {
  const { activeTilePreview, zones } = useDesktopStore(
    useShallow((s) => ({
      activeTilePreview: s.activeTilePreview,
      zones: s.zones,
    }))
  );

  const zone = zones.find((z) => z.id === activeTilePreview);
  const reduced = useReducedMotion();

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
          exit={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
          initial={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
          transition={{
            type: reduced ? "tween" : "spring",
            stiffness: 400,
            damping: 30,
            duration: reduced ? 0.2 : undefined,
          }}
        >
          {/* Ghost window preview */}
          <div className="absolute inset-4 rounded-xl border border-biolum/20 bg-void-surface/30">
            {/* Window chrome preview */}
            <div className="flex items-center gap-2 border-b border-biolum/10 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-biolum/30" />
              <div className="h-2 w-2 rounded-full bg-biolum/30" />
              <div className="h-2 w-2 rounded-full bg-biolum/30" />
              <div className="ml-2 h-1.5 w-24 rounded bg-biolum/20" />
            </div>
            {/* Window content preview */}
            <div className="p-4 space-y-2">
              <div className="h-2 w-3/4 rounded bg-biolum/10" />
              <div className="h-2 w-1/2 rounded bg-biolum/10" />
            </div>
          </div>

          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={
                reduced ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }
              }
              className="flex flex-col items-center gap-2 rounded-full bg-void-surface/80 p-4 px-6 shadow-2xl ring-1 ring-biolum/30"
              transition={
                reduced
                  ? { duration: 0.2 }
                  : {
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 2,
                      ease: "easeInOut",
                    }
              }
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
