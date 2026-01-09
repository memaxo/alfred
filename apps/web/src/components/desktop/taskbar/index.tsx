"use client";

/**
 * Taskbar - Windows 11-inspired bottom taskbar
 *
 * Provides:
 * - App launcher button (Alfred logo)
 * - Pinned apps section
 * - Running apps with previews
 * - System tray
 *
 * Icons and labels are pulled from windowRegistry (single source of truth).
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 2.3
 */

import { MessageSquare } from "lucide-react";
import { type CSSProperties, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getWindowIcon,
  getWindowLabel,
} from "@/components/desktop/windows/registry";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { WindowType } from "@/store/desktop/types.new";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TaskbarProps = {
  style?: CSSProperties;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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

  // Get unique running window types
  const runningTypes = new Set(windows.map((w) => w.data?.type));

  const handleAppClick = useCallback(
    (type: WindowType) => {
      // Find existing window of this type
      const existing = windows.find((w) => w.data?.type === type);

      if (existing) {
        // Restore if minimized, then focus
        if (existing.state === "minimized") {
          restoreWindow(existing.id);
        }
        focusWindow(existing.id);
      } else {
        // Spawn new window
        spawnWindow(type);
      }
    },
    [windows, focusWindow, spawnWindow, restoreWindow]
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

          {/* Pinned Apps */}
          {dockPins.map((type) => (
            <TaskbarButton
              isFocused={
                windows.find((w) => w.id === focusedWindowId)?.data?.type ===
                type
              }
              isRunning={runningTypes.has(type)}
              key={type}
              onClick={() => handleAppClick(type)}
              type={type}
            />
          ))}

          {/* Running but unpinned apps */}
          {windows
            .filter((w) => !dockPins.includes(w.data?.type as WindowType))
            .map((w) => (
              <TaskbarButton
                isFocused={w.id === focusedWindowId}
                isRunning={true}
                key={w.id}
                onClick={() => focusWindow(w.id)}
                type={w.data?.type as WindowType}
              />
            ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP LAUNCHER BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function AppLauncherButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label="App Launcher"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-biolum/20 to-biolum/5 text-biolum transition-all hover:scale-105 hover:from-biolum/30 hover:to-biolum/10"
          type="button"
        >
          <span className="text-xl">⬡</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>App Launcher</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKBAR BUTTON
// ─────────────────────────────────────────────────────────────────────────────

type TaskbarButtonProps = {
  type: WindowType;
  isRunning: boolean;
  isFocused: boolean;
  onClick: () => void;
};

function TaskbarButton({
  type,
  isRunning,
  isFocused,
  onClick,
}: TaskbarButtonProps) {
  const Icon = getWindowIcon(type) ?? MessageSquare;
  const label = getWindowLabel(type);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
            isFocused
              ? "bg-biolum/20 text-biolum"
              : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
          )}
          onClick={onClick}
          type="button"
        >
          <Icon className="h-5 w-5" />

          {/* Running indicator */}
          {isRunning && (
            <div
              className={cn(
                "-translate-x-1/2 absolute bottom-1 left-1/2 h-1 rounded-full transition-all",
                isFocused ? "w-4 bg-biolum" : "w-1 bg-biolum/50"
              )}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export { AppLauncherButton, TaskbarButton };
