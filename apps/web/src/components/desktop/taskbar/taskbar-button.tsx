"use client";

import { MessageSquare } from "lucide-react";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getWindowIcon,
  getWindowLabel,
} from "@/components/desktop/windows/registry";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance, WindowType } from "@/store/desktop/types.new";
import { WindowPreview } from "./window-preview";

type TaskbarButtonProps = {
  type: WindowType;
  isRunning: boolean;
  isFocused: boolean;
  onClick: () => void;
  windows: WindowInstance[];
};

export function TaskbarButton({
  type,
  isRunning,
  isFocused,
  onClick,
  windows,
}: TaskbarButtonProps) {
  const { pinnedApps, pinApp, unpinApp, removeWindow } = useDesktopStore(
    useShallow((s) => ({
      pinnedApps: s.pinnedApps,
      pinApp: s.pinApp,
      unpinApp: s.unpinApp,
      removeWindow: s.removeWindow,
    }))
  );

  const Icon = getWindowIcon(type) ?? MessageSquare;
  const label = getWindowLabel(type);
  const isPinned = pinnedApps.includes(type);

  const handleTogglePin = useCallback(() => {
    if (isPinned) {
      unpinApp(type);
    } else {
      pinApp(type);
    }
  }, [isPinned, type, pinApp, unpinApp]);

  const handleCloseAll = useCallback(() => {
    for (const win of windows) {
      removeWindow(win.id);
    }
  }, [windows, removeWindow]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Tooltip delayDuration={300}>
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
          <TooltipContent
            className="border-none bg-transparent p-0 shadow-none"
            side="top"
            sideOffset={10}
          >
            {isRunning ? (
              <div className="flex gap-2 p-2">
                {windows.map((win) => (
                  <WindowPreview key={win.id} window={win} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-white/10 bg-void-surface/95 px-3 py-1.5 text-biolum text-xs backdrop-blur-xl">
                {label}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </ContextMenuTrigger>
      <ContextMenuContent className="border-white/10 bg-void-surface/95 backdrop-blur-xl">
        <div className="px-2 py-1.5 font-medium text-biolum text-xs">
          {label}
        </div>
        <ContextMenuSeparator className="bg-white/5" />
        <ContextMenuItem
          className="text-biolum-dim hover:bg-white/5 hover:text-biolum focus:bg-white/5 focus:text-biolum"
          onClick={onClick}
        >
          {isRunning ? "Focus" : "Open"}
        </ContextMenuItem>
        <ContextMenuItem
          className="text-biolum-dim hover:bg-white/5 hover:text-biolum focus:bg-white/5 focus:text-biolum"
          onClick={handleTogglePin}
        >
          {isPinned ? "Unpin from Taskbar" : "Pin to Taskbar"}
        </ContextMenuItem>
        {isRunning && (
          <>
            <ContextMenuSeparator className="bg-white/5" />
            <ContextMenuItem
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
              onClick={handleCloseAll}
            >
              Close All Windows
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
