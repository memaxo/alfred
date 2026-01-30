import { MessageSquare } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import type { WindowInstance } from "@/store/desktop/types.new";

import {
  getWindowIcon,
  getWindowLabel,
} from "@/components/desktop/windows/registry";
import { useDesktopStore } from "@/store/desktop";

interface WindowPreviewProps {
  window: WindowInstance;
}

export function WindowPreview({ window }: WindowPreviewProps) {
  const { focusWindow, restoreWindow } = useDesktopStore(
    useShallow((s) => ({
      focusWindow: s.focusWindow,
      restoreWindow: s.restoreWindow,
    }))
  );

  const Icon = getWindowIcon(window.type) ?? MessageSquare;
  const label = window.data?.label ?? getWindowLabel(window.type);

  const handleClick = () => {
    if (window.state === "minimized") {
      restoreWindow(window.id);
    }
    focusWindow(window.id);
  };

  return (
    <div
      className="group w-48 overflow-hidden rounded-lg border border-white/10 bg-void-surface shadow-2xl transition-all hover:border-biolum/30"
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* Visual Placeholder for Thumbnail */}
      <div className="flex h-28 w-full items-center justify-center bg-void/50 p-4">
        <div className="relative flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-biolum/10 text-biolum shadow-[0_0_20px_rgba(0,255,136,0.1)] ring-1 ring-biolum/20 transition-all group-hover:bg-biolum/20 group-hover:shadow-[0_0_30px_rgba(0,255,136,0.2)]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="h-1.5 w-12 rounded-full bg-white/5" />
          <div className="h-1.5 w-8 rounded-full bg-white/5" />
        </div>
      </div>

      {/* App Info */}
      <div className="flex items-center gap-2 border-white/5 border-t bg-white/5 p-2 px-3">
        <Icon className="h-3 w-3 text-biolum-dim" />
        <span className="truncate font-medium text-biolum text-xs">
          {label}
        </span>
      </div>
    </div>
  );
}
