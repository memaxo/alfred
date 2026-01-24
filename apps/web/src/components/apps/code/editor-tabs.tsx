"use client";

/**
 * Editor Tabs - Tab management with drag-and-drop reordering
 */

import { GripVertical, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { FileTab } from "./types";

type EditorTabsProps = {
  tabs: FileTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder?: (tabs: FileTab[]) => void;
  className?: string;
};

export function EditorTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onReorder,
  className,
}: EditorTabsProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartIndex = useRef<number>(-1);

  const handleDragStart = useCallback(
    (e: React.DragEvent, tabId: string, index: number) => {
      setDraggedId(tabId);
      dragStartIndex.current = index;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (tabId !== draggedId) {
        setDragOverId(tabId);
      }
    },
    [draggedId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    dragStartIndex.current = -1;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId || !onReorder) {
        handleDragEnd();
        return;
      }

      const dragIndex = tabs.findIndex((t) => t.id === draggedId);
      const dropIndex = tabs.findIndex((t) => t.id === targetId);

      if (dragIndex === -1 || dropIndex === -1) {
        handleDragEnd();
        return;
      }

      const newTabs = [...tabs];
      const [removed] = newTabs.splice(dragIndex, 1);
      if (removed) {
        newTabs.splice(dropIndex, 0, removed);
        onReorder(newTabs);
      }

      handleDragEnd();
    },
    [draggedId, tabs, onReorder, handleDragEnd]
  );

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
      {tabs.map((tab, index) => (
        <div
          className={cn(
            "group flex h-7 items-center gap-1 rounded-t-lg px-2 text-sm transition-all",
            activeId === tab.id
              ? "bg-void-surface text-biolum"
              : "text-biolum-dim hover:bg-white/5 hover:text-biolum",
            draggedId === tab.id && "opacity-50",
            dragOverId === tab.id && "border-biolum border-l-2"
          )}
          draggable
          key={tab.id}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, tab.id)}
          onDragStart={(e) => handleDragStart(e, tab.id, index)}
          onDrop={(e) => handleDrop(e, tab.id)}
        >
          <GripVertical className="h-3 w-3 cursor-grab opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-50" />
          <button
            className="max-w-[100px] truncate"
            onClick={() => onSelect(tab.id)}
            type="button"
          >
            {tab.name}
          </button>
          {tab.isDirty && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-biolum" />
          )}
          <button
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
