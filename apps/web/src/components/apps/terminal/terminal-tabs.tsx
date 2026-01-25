"use client";

/**
 * Terminal Tabs - Tab management for terminal
 */

import { Terminal, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface TerminalTab {
  id: string;
  title: string;
}

interface TerminalTabsProps {
  tabs: TerminalTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  className?: string;
}

export function TerminalTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  className,
}: TerminalTabsProps) {
  return (
    <div className={cn("flex items-center gap-0.5 overflow-x-auto", className)}>
      {tabs.map((tab) => (
        <button
          className={cn(
            "group flex h-7 items-center gap-1.5 rounded px-2 text-xs transition-colors",
            activeId === tab.id
              ? "bg-void text-biolum"
              : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
          )}
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          type="button"
        >
          <Terminal className="h-3 w-3" />
          <span className="max-w-[80px] truncate">{tab.title}</span>
          <button
            className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  );
}
