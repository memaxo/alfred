"use client";

/**
 * Menu Bar - macOS-inspired top menu bar
 *
 * Provides:
 * - Alfred menu (logo, about, preferences, quit)
 * - App-specific menus (File, Edit, View, etc.) - dynamic based on focused window
 * - Status area (clock, system status)
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 2.2
 */

import {
  Activity,
  Battery,
  Bell,
  Cpu,
  Flame,
  HelpCircle,
  Info,
  LogOut,
  type LucideIcon,
  Settings,
  Wifi,
} from "lucide-react";
import { type CSSProperties, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCognitivePhysiology } from "@/hooks/use-cognitive-physiology";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import { Clock } from "./clock";
import type { AppMenuAction, AppMenuCategory, AppMenus } from "./types";

type MenuBarProps = {
  style?: CSSProperties;
};

export function MenuBar({ style }: MenuBarProps) {
  const {
    focusedWindowId,
    windows,
    spawnWindow,
    getMenusForWindow,
    removeWindow,
    minimizeWindow,
    maximizeWindow,
    tileWindow,
    setSpaceMode,
    isSpaceMode,
  } = useDesktopStore(
    useShallow((s) => ({
      focusedWindowId: s.focusedWindowId,
      windows: s.windows,
      spawnWindow: s.spawnWindow,
      getMenusForWindow: s.getMenusForWindow,
      removeWindow: s.removeWindow,
      minimizeWindow: s.minimizeWindow,
      maximizeWindow: s.maximizeWindow,
      tileWindow: s.tileWindow,
      setSpaceMode: s.setSpaceMode,
      isSpaceMode: s.isSpaceMode,
    }))
  );

  // Get focused window info for context-sensitive menus
  const focusedWindow = windows.find((w) => w.id === focusedWindowId);
  const focusedAppName = focusedWindow?.data?.label ?? "ALFRED";
  const focusedWindowType = focusedWindow?.data?.type;

  // Menu action handlers
  const handleClose = useCallback(() => {
    if (focusedWindowId) {
      removeWindow(focusedWindowId);
    }
  }, [focusedWindowId, removeWindow]);

  const handleMinimize = useCallback(() => {
    if (focusedWindowId) {
      minimizeWindow(focusedWindowId);
    }
  }, [focusedWindowId, minimizeWindow]);

  const handleMaximize = useCallback(() => {
    if (focusedWindowId) {
      maximizeWindow(focusedWindowId);
    }
  }, [focusedWindowId, maximizeWindow]);

  const handleToggleMindscape = useCallback(() => {
    setSpaceMode(!isSpaceMode);
  }, [setSpaceMode, isSpaceMode]);

  const handleTileLeft = useCallback(() => {
    if (focusedWindowId) {
      tileWindow(focusedWindowId, "left");
    }
  }, [focusedWindowId, tileWindow]);

  const handleTileRight = useCallback(() => {
    if (focusedWindowId) {
      tileWindow(focusedWindowId, "right");
    }
  }, [focusedWindowId, tileWindow]);

  // Build default menus with bound handlers
  const defaultMenus: AppMenus = useMemo(
    () => ({
      File: [
        {
          id: "close",
          label: "Close Window",
          shortcut: "⌘W",
          onClick: handleClose,
          disabled: !focusedWindowId,
        },
      ],
      Edit: [
        { id: "undo", label: "Undo", shortcut: "⌘Z", disabled: true },
        { id: "redo", label: "Redo", shortcut: "⇧⌘Z", disabled: true },
        { id: "sep-1", label: "", separator: true },
        { id: "cut", label: "Cut", shortcut: "⌘X", disabled: true },
        { id: "copy", label: "Copy", shortcut: "⌘C", disabled: true },
        { id: "paste", label: "Paste", shortcut: "⌘V", disabled: true },
      ],
      View: [
        {
          id: "toggle-mindscape",
          label: isSpaceMode ? "Exit Mindscape" : "Enter Mindscape",
          shortcut: "⌘M",
          onClick: handleToggleMindscape,
        },
      ],
      Window: [
        {
          id: "minimize",
          label: "Minimize",
          shortcut: "⌘H",
          onClick: handleMinimize,
          disabled: !focusedWindowId,
        },
        {
          id: "maximize",
          label: "Maximize",
          onClick: handleMaximize,
          disabled: !focusedWindowId,
        },
        { id: "sep-1", label: "", separator: true },
        {
          id: "tile-left",
          label: "Tile Left",
          shortcut: "⌃⌘←",
          onClick: handleTileLeft,
          disabled: !focusedWindowId,
        },
        {
          id: "tile-right",
          label: "Tile Right",
          shortcut: "⌃⌘→",
          onClick: handleTileRight,
          disabled: !focusedWindowId,
        },
      ],
      Help: [
        { id: "docs", label: "Documentation" },
        { id: "shortcuts", label: "Keyboard Shortcuts", shortcut: "⌘/" },
      ],
    }),
    [
      focusedWindowId,
      isSpaceMode,
      handleClose,
      handleMinimize,
      handleMaximize,
      handleToggleMindscape,
      handleTileLeft,
      handleTileRight,
    ]
  );

  // Get menus for focused window, falling back to defaults
  const windowMenus = getMenusForWindow(focusedWindowType);
  const activeMenus = windowMenus ?? defaultMenus;

  return (
    <div
      className="absolute top-0 right-0 left-0 flex h-8 items-center justify-between border-white/5 border-b bg-void-surface/80 px-3 backdrop-blur-xl"
      data-layer="menubar"
      style={style}
    >
      {/* Left: Alfred Menu + App Menus */}
      <div className="flex items-center gap-1">
        {/* Alfred Menu (Logo) */}
        <AlfredMenu onOpenSettings={() => spawnWindow("settings")} />

        {/* App-specific menus */}
        <AppMenuBar appName={focusedAppName} menus={activeMenus} />
      </div>

      {/* Right: Status Area */}
      <div className="flex items-center gap-3">
        <StatusIcons />
        <Clock />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALFRED MENU
// ─────────────────────────────────────────────────────────────────────────────

function AlfredMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 rounded px-2 py-1 font-semibold text-biolum text-sm transition-colors hover:bg-white/5"
          type="button"
        >
          <span className="text-base">⬡</span>
          <span>ALFRED</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem>
          <Info className="mr-2 h-4 w-4" />
          About ALFRED
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Preferences...
          <span className="ml-auto text-biolum-dim text-xs">⌘,</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400">
          <LogOut className="mr-2 h-4 w-4" />
          Quit ALFRED
          <span className="ml-auto text-biolum-dim text-xs">⌘Q</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP-SPECIFIC MENUS
// ─────────────────────────────────────────────────────────────────────────────

type AppMenuBarProps = {
  appName: string;
  menus: Partial<Record<AppMenuCategory, AppMenuAction[]>>;
};

function AppMenuBar({ appName, menus }: AppMenuBarProps) {
  const menuCategories: AppMenuCategory[] = [
    "File",
    "Edit",
    "View",
    "Window",
    "Help",
  ];

  return (
    <div className="flex items-center">
      {/* App name (bold) */}
      <span className="px-2 font-medium text-biolum text-sm">{appName}</span>

      {/* Standard menus */}
      {menuCategories.map((category) => {
        const actions = menus[category];
        if (!actions || actions.length === 0) {
          return null;
        }

        return (
          <DropdownMenu key={category}>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded px-2 py-1 text-biolum-dim text-sm transition-colors hover:bg-white/5 hover:text-biolum"
                type="button"
              >
                {category}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {actions.map((action) =>
                action.separator ? (
                  <DropdownMenuSeparator key={action.id} />
                ) : (
                  <DropdownMenuItem
                    disabled={action.disabled}
                    key={action.id}
                    onClick={action.onClick}
                  >
                    {action.label}
                    {action.shortcut && (
                      <span className="ml-auto text-biolum-dim text-xs">
                        {action.shortcut}
                      </span>
                    )}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS ICONS
// ─────────────────────────────────────────────────────────────────────────────

function StatusIcons() {
  const { energy, frustration, entropy } = useCognitivePhysiology();

  return (
    <div className="flex items-center gap-2 text-biolum-dim">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Cognitive Physiology"
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-biolum"
            type="button"
          >
            <div className="flex items-center gap-1">
              <Battery
                className={cn(
                  "h-3.5 w-3.5",
                  energy < 0.2 ? "text-red-400" : "text-emerald-400"
                )}
              />
              <span className="font-mono text-[10px]">
                {Math.round(energy * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Flame
                className={cn(
                  "h-3.5 w-3.5",
                  frustration > 0.7 ? "text-orange-400" : "text-biolum-dim"
                )}
              />
              <span className="font-mono text-[10px]">
                {Math.round(frustration * 100)}%
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 font-medium text-biolum text-xs uppercase tracking-widest opacity-60">
            Cognitive State
          </div>
          <DropdownMenuSeparator />
          <div className="space-y-3 p-3">
            <PhysiologyBar
              color="bg-emerald-500"
              icon={Battery}
              label="Energy"
              value={energy}
            />
            <PhysiologyBar
              color="bg-orange-500"
              icon={Flame}
              label="Frustration"
              value={frustration}
            />
            <PhysiologyBar
              color="bg-blue-500"
              icon={Activity}
              label="Entropy"
              value={entropy}
            />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => useDesktopStore.getState().spawnWindow("cortex")}
          >
            <Cpu className="mr-2 h-4 w-4" />
            Open Cortex Analyzer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        aria-label="Notifications"
        className="rounded p-1 transition-colors hover:bg-white/5 hover:text-biolum"
        type="button"
      >
        <Bell className="h-4 w-4" />
      </button>
      <button
        aria-label="Network"
        className="rounded p-1 transition-colors hover:bg-white/5 hover:text-biolum"
        type="button"
      >
        <Wifi className="h-4 w-4" />
      </button>
    </div>
  );
}

function PhysiologyBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3 text-biolum-dim" />
          <span className="text-biolum text-xs">{label}</span>
        </div>
        <span className="font-mono text-[10px] text-biolum-dim">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full transition-all duration-1000", color)}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export { Clock };
