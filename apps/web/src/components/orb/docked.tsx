"use client";

/**
 * Docked Orb - Menu bar/taskbar integration
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
import { useOrbStore } from "@/store/orb";

import { OrbCore } from "./core";
import { QuickActions } from "./quick-actions";

export function DockedOrb() {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const expand = useOrbStore((s) => s.expand);
  const float = useOrbStore((s) => s.float);
  const state = useOrbStore((s) => s.state);

  const handleClick = () => {
    if (state === "idle") {
      setShowQuickActions(!showQuickActions);
    } else {
      expand();
    }
  };

  const handleDoubleClick = () => {
    float();
  };

  return (
    <div className="relative">
      <div
        className="cursor-pointer"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <OrbCore size="sm" />
      </div>

      {/* Quick Actions Popover */}
      {showQuickActions && (
        <QuickActions
          className="-translate-x-1/2 absolute top-full left-1/2 mt-2"
          onClose={() => setShowQuickActions(false)}
        />
      )}

      {/* State indicator */}
      {state !== "idle" && (
        <div
          className={cn(
            "-bottom-0.5 -translate-x-1/2 absolute left-1/2 h-1 w-1 rounded-full",
            state === "listening" && "animate-pulse bg-blue-400",
            state === "thinking" && "animate-spin bg-purple-400",
            state === "talking" && "animate-pulse bg-green-400",
            state === "active" && "animate-pulse bg-biolum"
          )}
        />
      )}
    </div>
  );
}
