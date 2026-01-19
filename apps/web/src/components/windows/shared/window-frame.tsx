import { Handle, Position } from "@xyflow/react";
import { Maximize2, Minimize2, Pin, X } from "lucide-react";
import type { ReactNode } from "react";
import { Toolbar } from "@/components/ai-elements/toolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { ViewMode, WindowType } from "@/store/desktop/types.new";
import { useWindowFocus } from "./focus";

export type WindowTier = "primary" | "secondary" | "tertiary";

const tierConfig: Record<WindowTier, { types: readonly WindowType[] }> = {
  primary: { types: ["chat", "droid"] },
  secondary: {
    types: ["workflow", "workflowlist", "note", "reminder", "todo"],
  },
  tertiary: {
    types: ["settings", "integrations", "knowledge", "concept", "terminal"],
  },
};

const tierStyles: Record<WindowTier, { glow: string; border: string }> = {
  primary: {
    glow: "shadow-[0_0_30px_rgba(0,255,136,0.4)]",
    border: "border-[#00FF88]/60",
  },
  secondary: {
    glow: "shadow-[0_0_20px_rgba(255,255,255,0.2)]",
    border: "border-white/30",
  },
  tertiary: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.1)]",
    border: "border-white/15",
  },
};

function getWindowTier(type: WindowType): WindowTier {
  for (const [tier, config] of Object.entries(tierConfig)) {
    if ((config.types as readonly string[]).includes(type)) {
      return tier as WindowTier;
    }
  }
  return "tertiary";
}

export type WindowFrameProps = {
  id: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
  selected?: boolean;
  windowType: WindowType;
  tier?: WindowTier;
  width?: number;
  height?: number;
  closable?: boolean;
  handles?: { source?: boolean; target?: boolean };
  modes?: ViewMode[];
};

export function WindowFrame({
  id,
  title,
  children,
  footer,
  actions,
  className,
  selected,
  windowType,
  tier: tierOverride,
  width = 360,
  closable = true,
  handles = { source: true, target: true },
  modes = ["compact", "full"],
}: WindowFrameProps) {
  const removeWindow = useDesktopStore((s) => s.removeWindow);
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const isSpaceMode = useDesktopStore((s) => s.isSpaceMode);
  const viewMode = useDesktopStore(
    (s) => s.windows.find((w) => w.id === id)?.data.viewMode ?? "full"
  );
  const { isDimmed, isFocused } = useWindowFocus(id);
  const isMindscape = isSpaceMode;

  const tier = tierOverride ?? getWindowTier(windowType);
  const style = tierStyles[tier];

  const handleViewModeToggle = () => {
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    updateWindowData(id, { viewMode: modes[nextIndex] });
  };

  return (
    <div
      aria-label={title}
      className={cn(
        "group relative flex flex-col rounded-3xl border bg-void-surface/40 backdrop-blur-xl",
        "transition-all duration-500 ease-fluid",
        style.border,
        style.glow,
        selected &&
          "scale-[1.01] border-biolum shadow-[0_0_15px_rgba(var(--biolum-rgb),0.3)]",
        isDimmed && "scale-95 opacity-20 blur-sm grayscale",
        isFocused &&
          "z-50 scale-105 border-biolum shadow-[0_0_30px_rgba(var(--biolum-rgb),0.2)]",
        className
      )}
      role="region"
      style={{ width }}
    >
      {isMindscape && handles.target && (
        <Handle position={Position.Left} type="target" />
      )}
      {isMindscape && handles.source && (
        <Handle position={Position.Right} type="source" />
      )}

      <div className="flex items-center justify-between rounded-t-3xl border-white/10 border-b bg-white/5 px-4 py-2">
        <span className="font-medium text-biolum tracking-tight">{title}</span>
        <div className="flex items-center gap-1">{actions}</div>
      </div>

      <div className="flex-1 overflow-auto p-0">{children}</div>

      {footer && (
        <div className="rounded-b-3xl border-white/10 border-t bg-white/5 px-4 py-2 text-biolum-dim text-xs">
          {footer}
        </div>
      )}

      {isMindscape ? (
        <Toolbar
          className="-translate-y-12 opacity-0 transition-opacity group-hover:opacity-100"
          position={Position.Top}
        >
          <Button
            aria-label="Pin window"
            className="h-6 w-6 hover:text-biolum"
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pin className="h-3 w-3" />
          </Button>
          {modes.length > 1 && (
            <Button
              aria-label="Toggle view mode"
              className="h-6 w-6 hover:text-biolum"
              onClick={handleViewModeToggle}
              size="icon"
              type="button"
              variant="ghost"
            >
              {viewMode === "maximized" ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          {closable && (
            <Button
              aria-label="Close window"
              className="h-6 w-6 hover:text-red-400"
              onClick={() => removeWindow(id)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </Toolbar>
      ) : null}
    </div>
  );
}
