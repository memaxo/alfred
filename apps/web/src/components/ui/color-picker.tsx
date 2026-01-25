import * as React from "react";

import { cn } from "@/lib/utils";

export interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  presetColors?: string[];
  className?: string;
  disabled?: boolean;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#000000",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
  "#fff",
  "#ffffff",
];

export function ColorPicker({
  value,
  onChange,
  presetColors = PRESET_COLORS,
  className,
  disabled = false,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleColorSelect = (color: string) => {
    onChange?.(color);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        className={cn(
          "h-10 w-10 cursor-pointer rounded-lg border-2 transition-all",
          "focus:outline-none focus:ring-2 focus:ring-biolum focus:ring-offset-2",
          value
            ? "border-white/20"
            : "border-biolum-dim/50 border-dashed bg-void-surface/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={value ? { backgroundColor: value } : undefined}
        title={value || "Select color"}
        type="button"
      >
        {!value && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-4 w-0.5 rotate-45 bg-biolum-dim/50" />
            <div className="absolute h-0.5 w-4 bg-biolum-dim/50" />
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-2 rounded-xl border border-white/10 bg-void-surface p-3 shadow-lg">
            <div className="grid grid-cols-5 gap-2">
              {presetColors.map((color) => (
                <button
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110",
                    "focus:outline-none focus:ring-2 focus:ring-biolum focus:ring-offset-2",
                    value === color
                      ? "border-biolum ring-2 ring-biolum/50"
                      : "border-transparent"
                  )}
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  style={{ backgroundColor: color }}
                  title={color}
                  type="button"
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 border-white/10 border-t pt-3">
              <input
                className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                disabled={disabled}
                onChange={(e) => onChange?.(e.target.value)}
                type="color"
                value={value || "#000000"}
              />
              <input
                className={cn(
                  "h-8 flex-1 rounded-lg px-3 text-sm",
                  "border border-white/10 bg-void-surface/80",
                  "focus:outline-none focus:ring-2 focus:ring-biolum",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                disabled={disabled}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder="#000000"
                type="text"
                value={value || ""}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
