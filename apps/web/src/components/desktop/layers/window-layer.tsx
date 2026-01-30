/**
 * Window Layer - Traditional DOM-based window rendering
 *
 * Renders all windows using traditional DOM elements (not ReactFlow).
 * Supports tiling and floating layouts with z-index stacking.
 *
 * @see docs/execplans/desktop-type-migration.md
 */

import { ReactFlowProvider } from "@xyflow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { WindowType } from "@/store/desktop/types.new";

import { WindowErrorBoundary } from "@/components/windows/shared/error-boundary";
import { useDesktopStore } from "@/store/desktop";

import { TileZonePreview } from "../tiling/zone-preview";
import { WindowChrome } from "../windows/chrome";
import {
  useWindowProps,
  windowRegistry,
  withWindowAdapter,
} from "../windows/registry";

interface WindowLayerProps {
  style?: CSSProperties;
  focusedWindowId: string | null;
}

function WindowRenderer({
  windowId,
  isFocused,
}: {
  windowId: string;
  isFocused: boolean;
}) {
  const props = useWindowProps(windowId);
  const windowType = props?.window.type as WindowType | undefined;
  const registryEntry = windowType ? windowRegistry[windowType] : undefined;
  const BaseComponent = registryEntry?.component ?? null;
  const isLegacy = registryEntry?.isLegacy ?? false;

  const Component = useMemo(() => {
    if (!BaseComponent) {
      return null;
    }
    return isLegacy ? withWindowAdapter(BaseComponent) : BaseComponent;
  }, [BaseComponent, isLegacy]);

  if (!(props && Component)) {
    return null;
  }

  return (
    <WindowChrome isFocused={isFocused} windowId={windowId}>
      <ReactFlowProvider>
        <WindowErrorBoundary windowId={windowId}>
          <Component {...props} />
        </WindowErrorBoundary>
      </ReactFlowProvider>
    </WindowChrome>
  );
}

export function WindowLayer({ style, focusedWindowId }: WindowLayerProps) {
  const { windows, desktopArea } = useDesktopStore(
    useShallow((s) => ({
      windows: s.windows,
      desktopArea: s.desktopArea,
    }))
  );

  const reduced = useReducedMotion();

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
        <AnimatePresence>
          {windows
            .filter((w) => w.state !== "minimized")
            .map((window) => (
              <WindowRenderer
                isFocused={window.id === focusedWindowId}
                key={window.id}
                windowId={window.id}
              />
            ))}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {windows.length === 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex h-full items-center justify-center"
              exit={{ opacity: 0, y: reduced ? 0 : -20 }}
              initial={{ opacity: 0, y: reduced ? 0 : 20 }}
            >
              <div className="text-center text-biolum-dim">
                <motion.div
                  animate={reduced ? { opacity: 1 } : { scale: [1, 1.05, 1] }}
                  className="mb-4 inline-block"
                  transition={
                    reduced
                      ? { duration: 0.2 }
                      : {
                          duration: 4,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }
                  }
                >
                  <p className="font-semibold text-2xl text-biolum tracking-tighter">
                    ALFRED
                  </p>
                </motion.div>
                <p className="text-sm tracking-tight opacity-60">
                  Press{" "}
                  <kbd className="mx-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs">
                    ⌘K
                  </kbd>{" "}
                  to begin
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
