/**
 * Visual Color Picker Component
 *
 * Color picker with oklch preview for visual configuration.
 * Follows the bioluminescent design system.
 */

import { useCallback, useId, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type VisualColorPickerProps = {
  /** Label for the color picker */
  label: string;
  /** Current oklch color string */
  value: string;
  /** Callback when color changes */
  onChange: (value: string) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Optional description */
  description?: string;
  /** Additional class name */
  className?: string;
};

/**
 * Parse oklch string to components
 */
function parseOklch(oklch: string): { L: number; C: number; H: number } | null {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) {
    return null;
  }
  return {
    L: Number.parseFloat(match[1] ?? "0"),
    C: Number.parseFloat(match[2] ?? "0"),
    H: Number.parseFloat(match[3] ?? "0"),
  };
}

/**
 * Format oklch components to string
 */
function formatOklch(L: number, C: number, H: number): string {
  return `oklch(${L.toFixed(2)} ${C.toFixed(2)} ${H.toFixed(0)})`;
}

export function VisualColorPicker({
  label,
  value,
  onChange,
  disabled = false,
  description,
  className,
}: VisualColorPickerProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const parsed = useMemo(() => parseOklch(value), [value]);
  const L = parsed?.L ?? 0.5;
  const C = parsed?.C ?? 0.1;
  const H = parsed?.H ?? 180;

  // Update handlers
  const updateL = useCallback(
    (newL: number) => onChange(formatOklch(newL, C, H)),
    [C, H, onChange]
  );

  const updateC = useCallback(
    (newC: number) => onChange(formatOklch(L, newC, H)),
    [L, H, onChange]
  );

  const updateH = useCallback(
    (newH: number) => onChange(formatOklch(L, C, newH)),
    [L, C, onChange]
  );

  // Generate hue preview gradient
  const hueGradient = useMemo(() => {
    const stops: string[] = [];
    for (let h = 0; h <= 360; h += 30) {
      stops.push(`oklch(${L} ${C} ${h})`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [L, C]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with label and color preview */}
      <div className="flex items-center justify-between">
        <label
          className="font-medium text-biolum text-sm tracking-tight"
          htmlFor={id}
        >
          {label}
        </label>

        <Popover onOpenChange={setIsOpen} open={isOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1",
                "border border-biolum/30 bg-void-surface/50",
                "transition-colors hover:border-biolum/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={disabled}
              id={id}
              type="button"
            >
              {/* Color swatch */}
              <div
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: value }}
              />
              <span className="font-mono text-biolum-dim text-xs">
                {value.slice(6, -1)}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-64 space-y-4 rounded-2xl border border-white/10 bg-void-surface/90 p-4 backdrop-blur-xl"
          >
            {/* Large preview */}
            <div
              className="h-16 w-full rounded-xl border border-white/10"
              style={{ backgroundColor: value }}
            />

            {/* Lightness slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-biolum-faint text-xs">
                <span>Lightness</span>
                <span>{(L * 100).toFixed(0)}%</span>
              </div>
              <input
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                max="1"
                min="0"
                onChange={(e) => updateL(Number.parseFloat(e.target.value))}
                step="0.01"
                style={{
                  background: `linear-gradient(to right, oklch(0 ${C} ${H}), oklch(1 ${C} ${H}))`,
                }}
                type="range"
                value={L}
              />
            </div>

            {/* Chroma slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-biolum-faint text-xs">
                <span>Chroma</span>
                <span>{C.toFixed(2)}</span>
              </div>
              <input
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                max="0.4"
                min="0"
                onChange={(e) => updateC(Number.parseFloat(e.target.value))}
                step="0.01"
                style={{
                  background: `linear-gradient(to right, oklch(${L} 0 ${H}), oklch(${L} 0.4 ${H}))`,
                }}
                type="range"
                value={C}
              />
            </div>

            {/* Hue slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-biolum-faint text-xs">
                <span>Hue</span>
                <span>{H.toFixed(0)}°</span>
              </div>
              <input
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                max="360"
                min="0"
                onChange={(e) => updateH(Number.parseFloat(e.target.value))}
                step="1"
                style={{
                  background: hueGradient,
                }}
                type="range"
                value={H}
              />
            </div>

            {/* Raw value display */}
            <div className="border-white/10 border-t pt-2">
              <input
                className="w-full rounded border border-white/10 bg-void/50 px-2 py-1 font-mono text-biolum-dim text-xs"
                onChange={(e) => onChange(e.target.value)}
                type="text"
                value={value}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Description if provided */}
      {description && (
        <p className="text-biolum-faint text-xs">{description}</p>
      )}
    </div>
  );
}
