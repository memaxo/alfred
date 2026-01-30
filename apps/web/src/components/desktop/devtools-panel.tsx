import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

export function AlfredDesktopDevtoolsPanel() {
  const windows = useDesktopStore((s) => s.windows);
  const focusedWindowId = useDesktopStore((s) => s.focusedWindowId);
  const mode = useDesktopStore((s) => s.mode);

  const sortedWindows = useMemo(
    () => [...windows].sort((a, b) => b.zIndex - a.zIndex),
    [windows]
  );

  return (
    <div className="flex h-full flex-col overflow-auto bg-void p-4 font-mono text-biolum-bright text-xs">
      <div className="mb-4 space-y-1">
        <div className="flex justify-between border-white/5 border-b pb-1">
          <span className="text-biolum-dim">Mode</span>
          <span className="text-biolum uppercase">{mode}</span>
        </div>
        <div className="flex justify-between border-white/5 border-b pb-1">
          <span className="text-biolum-dim">Focused</span>
          <span className="text-biolum">{focusedWindowId || "null"}</span>
        </div>
      </div>

      <div className="flex-1">
        <div className="mb-2 text-[10px] text-biolum-dim uppercase tracking-wider">
          Window Stack ({windows.length})
        </div>
        <div className="space-y-2">
          {sortedWindows.map((win) => (
            <div
              className={cn(
                "rounded border p-2 transition-colors",
                win.id === focusedWindowId
                  ? "border-biolum/50 bg-biolum/10 shadow-[inset_0_0_10px_rgba(0,243,255,0.05)]"
                  : "border-white/10 bg-white/5"
              )}
              key={win.id}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="truncate pr-2 font-bold text-biolum">
                  {win.type}
                </span>
                <span className="shrink-0 rounded bg-white/5 px-1 text-[10px] text-biolum-dim">
                  z:{win.zIndex}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-[10px] text-biolum-dim">
                <span className="truncate">ID: {win.id.slice(0, 8)}...</span>
                <span className="text-right uppercase">{win.state}</span>
                <span>
                  {win.bounds.width}x{win.bounds.height}
                </span>
                <span className="text-right">
                  @{win.bounds.x},{win.bounds.y}
                </span>
              </div>
            </div>
          ))}
          {windows.length === 0 && (
            <div className="py-8 text-center text-biolum-dim italic">
              No windows open
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
