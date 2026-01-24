"use client";

/**
 * TUI Mode Toggle - Switch between standard terminal and TUI widget mode
 *
 * Enables the @alfred/tui package's rich text UI mode within the terminal.
 *
 * @see @alfred/tui package
 */

import { LayoutGrid, Settings2, Terminal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TuiModeProps = {
  className?: string;
  onModeChange?: (mode: "standard" | "tui") => void;
};

type TuiWidget = {
  id: string;
  name: string;
  description: string;
  icon: typeof Terminal;
  enabled: boolean;
};

const mockWidgets: TuiWidget[] = [
  {
    id: "file-browser",
    name: "File Browser",
    description: "Navigate files with arrow keys",
    icon: LayoutGrid,
    enabled: true,
  },
  {
    id: "process-list",
    name: "Process List",
    description: "Interactive process manager",
    icon: Terminal,
    enabled: true,
  },
  {
    id: "git-status",
    name: "Git Status",
    description: "Visual git status and staging",
    icon: Terminal,
    enabled: false,
  },
  {
    id: "log-viewer",
    name: "Log Viewer",
    description: "Scrollable log with filtering",
    icon: Terminal,
    enabled: false,
  },
];

export function TuiMode({ className, onModeChange }: TuiModeProps) {
  const [mode, setMode] = useState<"standard" | "tui">("standard");
  const [showWidgets, setShowWidgets] = useState(false);

  const handleModeChange = (newMode: "standard" | "tui") => {
    setMode(newMode);
    onModeChange?.(newMode);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/5 p-3",
        className
      )}
    >
      {/* Mode Toggle */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-sm">Terminal Mode</span>
        <div className="flex rounded-lg border border-white/10">
          <button
            className={cn(
              "flex items-center gap-1 px-3 py-1 text-xs transition-colors",
              mode === "standard"
                ? "bg-biolum/20 text-biolum"
                : "text-biolum-dim hover:text-biolum"
            )}
            onClick={() => handleModeChange("standard")}
            type="button"
          >
            <Terminal className="h-3 w-3" />
            Standard
          </button>
          <button
            className={cn(
              "flex items-center gap-1 px-3 py-1 text-xs transition-colors",
              mode === "tui"
                ? "bg-biolum/20 text-biolum"
                : "text-biolum-dim hover:text-biolum"
            )}
            onClick={() => handleModeChange("tui")}
            type="button"
          >
            <LayoutGrid className="h-3 w-3" />
            TUI
          </button>
        </div>
      </div>

      {/* TUI Description */}
      {mode === "tui" && (
        <div className="mb-3 rounded bg-biolum/10 p-2 text-sm">
          <p className="text-biolum">TUI Mode Active</p>
          <p className="mt-1 text-biolum-dim text-xs">
            Rich text UI widgets enabled. Use arrow keys to navigate, Enter to
            select.
          </p>
        </div>
      )}

      {/* Widget Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-biolum-dim text-xs">
          {mockWidgets.filter((w) => w.enabled).length} widgets enabled
        </span>
        <Button
          className="h-6 gap-1"
          onClick={() => setShowWidgets(!showWidgets)}
          size="sm"
          variant="ghost"
        >
          <Settings2 className="h-3 w-3" />
          Widgets
        </Button>
      </div>

      {/* Widget List */}
      {showWidgets && (
        <div className="mt-3 space-y-2 border-white/5 border-t pt-3">
          {mockWidgets.map((widget) => (
            <div
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2"
              key={widget.id}
            >
              <div className="flex items-center gap-2">
                <widget.icon className="h-4 w-4 text-biolum" />
                <div>
                  <div className="text-sm">{widget.name}</div>
                  <div className="text-biolum-dim text-xs">
                    {widget.description}
                  </div>
                </div>
              </div>
              <input
                className="accent-biolum"
                defaultChecked={widget.enabled}
                type="checkbox"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
