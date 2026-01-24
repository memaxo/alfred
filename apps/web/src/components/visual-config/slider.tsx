/**
 * Visual Slider Component
 *
 * Labeled slider with min/max/value display for visual configuration.
 * Follows the bioluminescent design system.
 */

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useCallback, useId } from "react";

import { cn } from "@/lib/utils";

export type VisualSliderProps = {
  /** Label for the slider */
  label: string;
  /** Current value */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step?: number;
  /** Number of decimal places to display */
  decimals?: number;
  /** Unit suffix (e.g., "px", "%", "ms") */
  unit?: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Optional description */
  description?: string;
  /** Additional class name */
  className?: string;
};

export function VisualSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit = "",
  disabled = false,
  description,
  className,
}: VisualSliderProps) {
  const id = useId();

  const handleChange = useCallback(
    (values: number[]) => {
      const newValue = values[0];
      if (newValue !== undefined) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  const displayValue = value.toFixed(decimals);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with label and value */}
      <div className="flex items-center justify-between">
        <label
          className="font-medium text-biolum text-sm tracking-tight"
          htmlFor={id}
        >
          {label}
        </label>
        <span className="text-biolum-dim text-sm tabular-nums">
          {displayValue}
          {unit && <span className="ml-0.5 text-biolum-faint">{unit}</span>}
        </span>
      </div>

      {/* Description if provided */}
      {description && (
        <p className="text-biolum-faint text-xs">{description}</p>
      )}

      {/* Slider */}
      <SliderPrimitive.Root
        className={cn(
          "relative flex w-full touch-none select-none items-center py-1",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onValueChange={handleChange}
        step={step}
        value={[value]}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-biolum/20">
          <SliderPrimitive.Range className="absolute h-full bg-biolum transition-all" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          className={cn(
            "block h-4 w-4 rounded-full bg-biolum transition-transform",
            "hover:scale-110 focus-visible:outline-none focus-visible:ring-0",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        />
      </SliderPrimitive.Root>

      {/* Min/Max labels */}
      <div className="flex justify-between text-biolum-faint text-xs">
        <span>
          {min.toFixed(decimals)}
          {unit}
        </span>
        <span>
          {max.toFixed(decimals)}
          {unit}
        </span>
      </div>
    </div>
  );
}
