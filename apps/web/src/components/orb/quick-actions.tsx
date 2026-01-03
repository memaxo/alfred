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
import { cn } from "@/lib/utils";
import { useOrbStore } from "@/store/orb";

type QuickActionsProps = {
  onClose: () => void;
  className?: string;
};

const actions = [
  {
    id: "chat",
    icon: MessageSquare,
    label: "New Chat",
    color: "text-blue-400",
  },
  { id: "voice", icon: Mic, label: "Voice Mode", color: "text-green-400" },
  {
    id: "terminal",
    icon: Terminal,
    label: "Terminal",
    color: "text-orange-400",
  },
  { id: "files", icon: FileText, label: "Files", color: "text-yellow-400" },
  { id: "agents", icon: Bot, label: "Agents", color: "text-purple-400" },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    color: "text-biolum-dim",
  },
];

export function QuickActions({ onClose, className }: QuickActionsProps) {
  const expand = useOrbStore((s) => s.expand);

  const handleAction = (actionId: string) => {
    if (actionId === "voice") {
      expand();
    }
    // TODO: Handle other actions (open windows)
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
