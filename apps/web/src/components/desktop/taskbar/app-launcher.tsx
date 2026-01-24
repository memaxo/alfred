"use client";

import { MessageSquare, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { WindowType } from "@/store/desktop/types.new";

import {
  getSpawnableWindowTypes,
  getWindowIcon,
  getWindowLabel,
  windowRegistry,
} from "@/components/desktop/windows/registry";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

export function AppLauncherButton() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { spawnWindow, recentApps } = useDesktopStore(
    useShallow((s) => ({
      spawnWindow: s.spawnWindow,
      recentApps: s.recentApps,
    }))
  );

  const spawnableTypes = useMemo(() => getSpawnableWindowTypes(), []);

  const categories = useMemo(() => {
    const groups = {
      Core: [] as WindowType[],
      Productivity: [] as WindowType[],
      System: [] as WindowType[],
    };

    const filtered = spawnableTypes.filter((type) => {
      if (!search) {
        return true;
      }
      const label = getWindowLabel(type).toLowerCase();
      return label.includes(search.toLowerCase());
    });

    for (const type of filtered) {
      const tier = windowRegistry[type]?.metadata?.tier;
      if (tier === "primary") {
        groups.Core.push(type);
      } else if (tier === "secondary") {
        groups.Productivity.push(type);
      } else {
        groups.System.push(type);
      }
    }

    return Object.entries(groups).filter(([_, apps]) => apps.length > 0);
  }, [spawnableTypes, search]);

  const recentList = useMemo(() => {
    if (search) {
      return [];
    }
    return recentApps.slice(0, 4);
  }, [recentApps, search]);

  const handleLaunch = useCallback(
    (type: WindowType) => {
      spawnWindow(type);
      setOpen(false);
      setSearch("");
    },
    [spawnWindow]
  );

  return (
    <Popover
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) {
          setSearch("");
        }
      }}
      open={open}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              aria-label="App Launcher"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-biolum/20 to-biolum/5 text-biolum transition-all hover:scale-105 hover:from-biolum/30 hover:to-biolum/10",
                open && "scale-105 from-biolum/30 to-biolum/10"
              )}
              type="button"
            >
              <span className="text-xl">⬡</span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>App Launcher</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="w-96 border-white/10 bg-void-surface/95 p-0 backdrop-blur-xl"
        side="top"
        sideOffset={12}
      >
        <div className="flex h-[480px] flex-col">
          {/* Search Header */}
          <div className="border-white/5 border-b p-3">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-biolum-dim" />
              <Input
                autoFocus
                className="border-white/10 bg-void/50 pl-9 text-sm focus:border-biolum/50"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                value={search}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="space-y-6 py-3">
              {/* Recent Apps */}
              {recentList.length > 0 && (
                <section>
                  <div className="mb-2 px-1 font-medium text-biolum-dim text-xs uppercase tracking-wider">
                    Recent
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {recentList.map((type) => (
                      <AppGridButton
                        key={`recent-${type}`}
                        onClick={() => handleLaunch(type)}
                        type={type}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Categorized Apps */}
              {categories.map(([name, apps]) => (
                <section key={name}>
                  <div className="mb-2 px-1 font-medium text-biolum-dim text-xs uppercase tracking-wider">
                    {name}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {apps.map((type) => (
                      <AppGridButton
                        key={type}
                        onClick={() => handleLaunch(type)}
                        type={type}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {categories.length === 0 && (
                <div className="py-12 text-center text-biolum-dim text-sm">
                  No applications found matching "{search}"
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-white/5 border-t bg-white/5 p-3">
            <div className="flex items-center justify-between text-biolum-dim text-xs">
              <span>ALFRED OS v1.0</span>
              <button
                className="hover:text-biolum"
                onClick={() => handleLaunch("settings")}
                type="button"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AppGridButton({
  type,
  onClick,
}: {
  type: WindowType;
  onClick: () => void;
}) {
  const Icon = getWindowIcon(type) ?? MessageSquare;
  const label = getWindowLabel(type);

  return (
    <button
      className="flex flex-col items-center gap-1 rounded-lg p-2 text-biolum-dim transition-all hover:bg-white/5 hover:text-biolum active:scale-95"
      onClick={onClick}
      title={label}
      type="button"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-void-surface shadow-sm ring-1 ring-white/5">
        <Icon className="h-5 w-5" />
      </div>
      <span className="max-w-full truncate text-[10px]">{label}</span>
    </button>
  );
}
