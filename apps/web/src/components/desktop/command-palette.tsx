"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  type DesktopAction,
  type DesktopActionId,
  getActionsForWindow,
  getSpawnActions,
  getWindowTypeFromSpawnAction,
} from "@/config/desktop-actions";
import { useDesktopStore } from "@/store/desktop";

interface DesktopCommandPaletteProps {
  onVisualize?: (windowId: string) => void;
  onAsk?: (windowId: string, label?: string) => void;
}

export function DesktopCommandPalette({
  onVisualize,
  onAsk,
}: DesktopCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const focusedWindowId = useDesktopStore((s) => s.focusedWindowId);
  const windows = useDesktopStore((s) => s.windows);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);
  const removeWindow = useDesktopStore((s) => s.removeWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const pinType = useDesktopStore((s) => s.pinType);

  const focusedWindow = windows.find((w) => w.id === focusedWindowId);
  const focusedWindowType = focusedWindow?.data?.type ?? null;

  // Keyboard shortcut to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleAction = useCallback(
    (action: DesktopAction) => {
      setOpen(false);
      setSearch("");

      const actionId = action.id as DesktopActionId;

      // Handle spawn actions
      if (action.category === "spawn") {
        const windowType = getWindowTypeFromSpawnAction(actionId);
        if (windowType) {
          spawnWindow(windowType);
        }
        return;
      }

      // Handle window-specific actions (require focused window)
      if (!(focusedWindowId && focusedWindow)) {
        return;
      }

      switch (actionId) {
        case "focus": {
          focusWindow(focusedWindowId);
          break;
        }
        case "delete": {
          removeWindow(focusedWindowId);
          break;
        }
        case "pin": {
          if (focusedWindowType) {
            pinType(focusedWindowType);
          }
          break;
        }
        case "visualize": {
          onVisualize?.(focusedWindowId);
          break;
        }
        case "ask": {
          onAsk?.(focusedWindowId, focusedWindow.data?.label);
          break;
        }
        case "duplicate": {
          if (focusedWindowType) {
            spawnWindow(focusedWindowType, focusedWindow.data?.resourceRef);
          }
          break;
        }
        default: {
          break;
        }
      }
    },
    [
      focusedWindowId,
      focusedWindow,
      focusedWindowType,
      spawnWindow,
      removeWindow,
      focusWindow,
      pinType,
      onVisualize,
      onAsk,
    ]
  );

  // Filter actions based on search and context
  const availableActions = getActionsForWindow(focusedWindowType);
  const spawnActions = getSpawnActions();
  const contextActions = availableActions.filter((a) => a.category !== "spawn");

  const filterAction = (action: DesktopAction) => {
    if (!search) {
      return true;
    }
    const searchLower = search.toLowerCase();
    return (
      action.label.toLowerCase().includes(searchLower) ||
      action.aliases?.some((alias) => alias.toLowerCase().includes(searchLower))
    );
  };

  const filteredSpawnActions = spawnActions.filter(filterAction);
  const filteredContextActions = contextActions.filter(filterAction);

  return (
    <CommandDialog
      description="Search for actions or spawn new windows"
      onOpenChange={setOpen}
      open={open}
      title="Desktop Command Palette"
    >
      <CommandInput
        onValueChange={setSearch}
        placeholder="Type a command or search..."
        value={search}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Spawn Actions */}
        {filteredSpawnActions.length > 0 && (
          <CommandGroup heading="Create">
            {filteredSpawnActions.map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => handleAction(action)}
                value={`${action.label} ${action.aliases?.join(" ") ?? ""}`}
              >
                <action.icon className="mr-2 h-4 w-4" />
                <span>{action.label}</span>
                {action.shortcut && (
                  <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
                    {action.shortcut}
                  </kbd>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Context Actions (when window is focused) */}
        {focusedWindowId && filteredContextActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Actions for ${focusedWindow?.data?.label ?? focusedWindowType ?? "Window"}`}
            >
              {filteredContextActions.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleAction(action)}
                  value={`${action.label} ${action.aliases?.join(" ") ?? ""}`}
                >
                  <action.icon
                    className={`mr-2 h-4 w-4 ${action.variant === "destructive" ? "text-red-400" : ""}`}
                  />
                  <span
                    className={
                      action.variant === "destructive" ? "text-red-400" : ""
                    }
                  >
                    {action.label}
                  </span>
                  {action.shortcut && (
                    <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
                      {action.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
