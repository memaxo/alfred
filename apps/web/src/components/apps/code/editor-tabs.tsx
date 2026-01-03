"use client";

/**
 * Editor Tabs - Tab management for code editor
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  id: string;
  name: string;
  isDirty: boolean;
};

type EditorTabsProps = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  className?: string;
};

export function EditorTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  className,
}: EditorTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-0.5 overflow-x-auto border-white/5 border-b bg-void px-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          className={cn(
            "group flex h-7 items-center gap-1.5 rounded-t-lg px-3 text-sm transition-colors",
            activeId === tab.id
              ? "bg-void-surface text-biolum"
              : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
          )}
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          type="button"
        >
          <span className="max-w-[120px] truncate">{tab.name}</span>
          {tab.isDirty && (
            <span className="h-1.5 w-1.5 rounded-full bg-biolum" />
          )}
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
