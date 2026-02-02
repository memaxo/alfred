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

import { Bell } from "lucide-react";
import { type CSSProperties, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { WindowInstance, WindowType } from "@/store/desktop/types.new";

import { Dock } from "@/components/dock";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDesktopStore } from "@/store/desktop";

import { AppLauncherButton } from "./app-launcher";
import { TaskbarButton } from "./taskbar-button";

interface TaskbarProps {
  style?: CSSProperties;
}

export function Taskbar({ style }: TaskbarProps) {
  const {
    dockPins,
    windows,
    focusedWindowId,
    spawnWindow,
    focusWindow,
    restoreWindow,
    notifications,
    toggleNotificationCenter,
  } = useDesktopStore(
    useShallow((s) => ({
      dockPins: s.dockPins,
      windows: s.windows,
      focusedWindowId: s.focusedWindowId,
      spawnWindow: s.spawnWindow,
      focusWindow: s.focusWindow,
      restoreWindow: s.restoreWindow,
      notifications: s.notifications,
      toggleNotificationCenter: s.toggleNotificationCenter,
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
    return [...all];
  }, [dockPins, windowsByType]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

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
        <Dock>
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
        </Dock>

        {/* System Tray */}
        <div className="absolute right-3 flex items-center gap-2">
          <Button
            aria-label="Notifications"
            className="relative h-9 w-9"
            onClick={toggleNotificationCenter}
            size="icon"
            variant="ghost"
          >
            <Bell className="h-4 w-4 text-biolum-dim" />
            {unreadCount > 0 && (
              <span className="-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-biolum px-1 text-[10px] text-void">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
