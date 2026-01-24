/**
 * Visual Toggle Component
 *
 * On/off switch for visual features with label.
 * Follows the bioluminescent design system.
 */

import { Switch as SwitchPrimitive } from "radix-ui";
import { useCallback, useId } from "react";

import { cn } from "@/lib/utils";

export type VisualToggleProps = {
  /** Label for the toggle */
  label: string;
  /** Current state */
  checked: boolean;
  /** Callback when state changes */
  onChange: (checked: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Optional description */
  description?: string;
  /** Additional class name */
  className?: string;
};

export function VisualToggle({
  label,
  checked,
  onChange,
  disabled = false,
  description,
  className,
}: VisualToggleProps) {
  const id = useId();

  const handleChange = useCallback(
    (newChecked: boolean) => {
      onChange(newChecked);
    },
    [onChange]
  );

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="space-y-0.5">
        <label
          className="cursor-pointer font-medium text-biolum text-sm tracking-tight"
          htmlFor={id}
        >
          {label}
        </label>
        {description && (
          <p className="text-biolum-faint text-xs">{description}</p>
        )}
      </div>

      <SwitchPrimitive.Root
        checked={checked}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
          "border border-biolum/30 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-biolum/30 data-[state=unchecked]:bg-void-surface/50"
        )}
        disabled={disabled}
        id={id}
        onCheckedChange={handleChange}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full transition-all",
            "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5",
            "data-[state=checked]:bg-biolum data-[state=unchecked]:bg-biolum-dim"
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
