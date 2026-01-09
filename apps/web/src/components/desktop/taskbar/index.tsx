"use client";

/**
 * Taskbar - Windows 11-inspired bottom taskbar
 *
 * Provides:
 * - App launcher button (Alfred logo) with enhanced popover
 * - Grouped pinned and running apps
 * - Window thumbnail previews on hover
 * - Taskbar context menus
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 2.3
 */

import { type CSSProperties, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance, WindowType } from "@/store/desktop/types.new";
import { AppLauncherButton } from "./app-launcher";
import { TaskbarButton } from "./taskbar-button";

type TaskbarProps = {
  style?: CSSProperties;
};

export function Taskbar({ style }: TaskbarProps) {
  const {
    dockPins,
    windows,
    focusedWindowId,
    spawnWindow,
    focusWindow,
    restoreWindow,
  } = useDesktopStore(
    useShallow((s) => ({
      dockPins: s.dockPins,
      windows: s.windows,
      focusedWindowId: s.focusedWindowId,
      spawnWindow: s.spawnWindow,
      focusWindow: s.focusWindow,
      restoreWindow: s.restoreWindow,
    }))
  );

  // Group windows by type
  const windowsByType = useMemo(() => {
    const groups: Record<string, WindowInstance[]> = {};
    for (const win of windows) {
      const type = win.data?.type;
      if (!type) {
        continue;
      }
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(win);
    }
    return groups;
  }, [windows]);

  // All types that should be visible in taskbar (pinned + running)
  const visibleTypes = useMemo(() => {
    const runningTypes = Object.keys(windowsByType) as WindowType[];
    const all = new Set([...dockPins, ...runningTypes]);
    return Array.from(all);
  }, [dockPins, windowsByType]);

  const handleAppClick = useCallback(
    (type: WindowType) => {
      const group = windowsByType[type];

      if (group && group.length > 0) {
        // If only one window, focus/restore it
        if (group.length === 1) {
          const win = group[0];
          if (win) {
            if (win.state === "minimized") {
              restoreWindow(win.id);
            }
            focusWindow(win.id);
          }
        } else {
          // If multiple windows, focus the most recently used one
          const sorted = [...group].sort(
            (a, b) => b.lastFocusedAt - a.lastFocusedAt
          );
          const win = sorted[0];
          if (win) {
            if (win.state === "minimized") {
              restoreWindow(win.id);
            }
            focusWindow(win.id);
          }
        }
      } else {
        // Spawn new window
        spawnWindow(type);
      }
    },
    [windowsByType, focusWindow, spawnWindow, restoreWindow]
  );

  return (
    <TooltipProvider>
      <div
        className="absolute right-0 bottom-0 left-0 flex h-12 items-center justify-center border-white/5 border-t bg-void-surface/80 backdrop-blur-xl"
        data-layer="taskbar"
        style={style}
      >
        <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
          {/* App Launcher */}
          <AppLauncherButton />

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-white/10" />

          {/* Apps */}
          {visibleTypes.map((type) => {
            const group = windowsByType[type] || [];
            const isFocused =
              windows.find((w) => w.id === focusedWindowId)?.data?.type ===
              type;

            return (
              <TaskbarButton
                isFocused={isFocused}
                isRunning={group.length > 0}
                key={type}
                onClick={() => handleAppClick(type)}
                type={type}
                windows={group}
              />
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
