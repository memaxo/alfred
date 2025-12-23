"use client";

import { Panel } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  CheckSquare,
  FileText,
  GitBranch,
  Link,
  List,
  MessageSquare,
  Settings,
  Terminal,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWindowLabel } from "@/components/windows/registry";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import type { WindowType } from "@/store/desktop/types";

const windowIcons: Record<WindowType, LucideIcon> = {
  chat: MessageSquare,
  terminal: Terminal,
  droid: Bot,
  note: FileText,
  reminder: Bell,
  todo: CheckSquare,
  workflow: GitBranch,
  workflowlist: List,
  settings: Settings,
  integrations: Link,
  knowledge: FileText,
  concept: FileText,
};

export function Dock() {
  const { dockPins, windows, spawnWindow } = useDesktopStore(
    useShallow((state) => ({
      dockPins: state.dockPins,
      windows: state.windows,
      spawnWindow: state.spawnWindow,
    }))
  );

  const runningTypes = new Set(windows.map((w) => w.data.type));

  return (
    <Panel position="bottom-center">
      <TooltipProvider delayDuration={200}>
        <div className="flex gap-2 rounded-full border border-white/10 bg-void-surface/80 px-4 py-2 backdrop-blur">
          {dockPins.map((type) => {
            const Icon = windowIcons[type];
            const isRunning = runningTypes.has(type);
            const label = getWindowLabel(type);

            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "h-10 w-10 rounded-full transition-all",
                      "hover:scale-110 hover:bg-white/10",
                      isRunning && "bg-white/5"
                    )}
                    onClick={() => spawnWindow(type)}
                    size="icon"
                    variant="ghost"
                  >
                    <Icon className="h-5 w-5 text-biolum" />
                    {isRunning && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-green-500" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="border-white/10 bg-void-surface"
                  side="top"
                >
                  <p className="text-biolum text-sm">{label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </Panel>
  );
}
