"use client";

import { Settings, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EditorSettings } from "./types";

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdateSettings: (updates: Partial<EditorSettings>) => void;
  className?: string;
};

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  className,
}: SettingsPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-12 right-2 z-50 w-72 rounded-xl border border-biolum/20 bg-void-surface/95 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between border-white/5 border-b p-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Editor Settings</span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 p-3">
        <SettingRow label="Font Size">
          <input
            className="w-16 rounded border border-white/10 bg-white/5 px-2 py-1 text-right text-sm"
            max={24}
            min={10}
            onChange={(e) =>
              onUpdateSettings({ fontSize: Number(e.target.value) })
            }
            type="number"
            value={settings.fontSize}
          />
        </SettingRow>

        <SettingRow label="Tab Size">
          <select
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm"
            onChange={(e) =>
              onUpdateSettings({ tabSize: Number(e.target.value) })
            }
            value={settings.tabSize}
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={8}>8 spaces</option>
          </select>
        </SettingRow>

        <SettingRow label="Word Wrap">
          <select
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm"
            onChange={(e) =>
              onUpdateSettings({
                wordWrap: e.target.value as EditorSettings["wordWrap"],
              })
            }
            value={settings.wordWrap}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="wordWrapColumn">Column</option>
          </select>
        </SettingRow>

        <SettingRow label="Minimap">
          <button
            className={cn(
              "h-6 w-10 rounded-full transition-colors",
              settings.minimap ? "bg-biolum" : "bg-white/20"
            )}
            onClick={() => onUpdateSettings({ minimap: !settings.minimap })}
            type="button"
          >
            <span
              className={cn(
                "block h-4 w-4 rounded-full bg-white transition-transform",
                settings.minimap ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
        </SettingRow>

        <SettingRow label="Line Numbers">
          <select
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm"
            onChange={(e) =>
              onUpdateSettings({
                lineNumbers: e.target.value as EditorSettings["lineNumbers"],
              })
            }
            value={settings.lineNumbers}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="relative">Relative</option>
          </select>
        </SettingRow>
      </div>

      <div className="border-white/5 border-t p-2 text-biolum-dim text-xs">
        Settings are saved automatically
      </div>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-biolum-dim text-sm">{label}</span>
      {children}
    </div>
  );
}
