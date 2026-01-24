/**
 * Preset Card Component
 *
 * Card for selecting visual presets with preview.
 * Follows the bioluminescent design system.
 */

import type { VisualPreset } from "@alfred/type";

import {
  Battery,
  Check,
  type LucideIcon,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

const PRESET_ICONS: Record<string, LucideIcon> = {
  minimal: Battery,
  performance: Zap,
  balanced: Sliders,
  maximum: Sparkles,
};

export type PresetCardProps = {
  /** Preset identifier */
  preset: VisualPreset;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether this preset is selected */
  selected: boolean;
  /** Whether this is the recommended preset */
  recommended?: boolean;
  /** Callback when selected */
  onSelect: () => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
};

export function PresetCard({
  preset,
  name,
  description,
  selected,
  recommended = false,
  onSelect,
  disabled = false,
  className,
}: PresetCardProps) {
  const Icon = PRESET_ICONS[preset] ?? Sliders;

  return (
    <button
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-3xl border p-6 transition-all",
        "group cursor-pointer text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/50",
        selected
          ? "border-biolum/50 bg-biolum/10"
          : "border-white/10 bg-void-surface/40 hover:border-biolum/30 hover:bg-void-surface/60",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-biolum">
          <Check className="h-3 w-3 text-void" strokeWidth={3} />
        </div>
      )}

      {/* Recommended badge */}
      {recommended && !selected && (
        <div className="absolute top-3 right-3 rounded-full bg-biolum/20 px-2 py-0.5 text-biolum text-xs">
          Recommended
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
          selected
            ? "bg-biolum/20"
            : "bg-void-surface/60 group-hover:bg-biolum/10"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6 transition-colors",
            selected ? "text-biolum" : "text-biolum-dim group-hover:text-biolum"
          )}
          strokeWidth={1.5}
        />
      </div>

      {/* Text content */}
      <div className="space-y-1 text-center">
        <h3
          className={cn(
            "font-semibold tracking-tight transition-colors",
            selected ? "text-biolum" : "text-biolum-dim group-hover:text-biolum"
          )}
        >
          {name}
        </h3>
        <p className="line-clamp-2 text-biolum-faint text-xs">{description}</p>
      </div>
    </button>
  );
}

/**
 * Preset grid container
 */
export function PresetGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>
      {children}
    </div>
  );
}
