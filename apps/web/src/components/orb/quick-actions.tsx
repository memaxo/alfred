"use client";

/**
 * Quick Actions - Context menu accessible from orb
 */

import {
  Bot,
  FileText,
  MessageSquare,
  Mic,
  Settings,
  Terminal,
} from "lucide-react";

import type { WindowType } from "@/store/desktop/types.new";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import { useOrbStore } from "@/store/orb";

interface QuickActionsProps {
  onClose: () => void;
  className?: string;
}

const actions: {
  id: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  color: string;
  windowType?: WindowType;
}[] = [
  {
    id: "chat",
    icon: MessageSquare,
    label: "New Chat",
    color: "text-blue-400",
    windowType: "chat",
  },
  { id: "voice", icon: Mic, label: "Voice Mode", color: "text-green-400" },
  {
    id: "terminal",
    icon: Terminal,
    label: "Terminal",
    color: "text-orange-400",
    windowType: "terminal",
  },
  {
    id: "files",
    icon: FileText,
    label: "Files",
    color: "text-yellow-400",
    windowType: "files",
  },
  {
    id: "agents",
    icon: Bot,
    label: "Agents",
    color: "text-purple-400",
    windowType: "agents",
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    color: "text-biolum-dim",
    windowType: "settings",
  },
];

export function QuickActions({ onClose, className }: QuickActionsProps) {
  const expand = useOrbStore((s) => s.expand);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  const handleAction = (actionId: string) => {
    if (actionId === "voice") {
      expand();
    }

    const action = actions.find((a) => a.id === actionId);
    if (action?.windowType) {
      spawnWindow(action.windowType);
    }

    onClose();
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-void-surface/95 p-2 shadow-xl backdrop-blur-sm",
        className
      )}
    >
      <div className="grid grid-cols-3 gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              className="flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-white/5"
              key={action.id}
              onClick={() => handleAction(action.id)}
              type="button"
            >
              <Icon className={cn("h-5 w-5", action.color)} />
              <span className="text-xs">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
