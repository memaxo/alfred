/**
 * Autonomy Slider Component
 *
 * Pure component for selecting autonomy level (read/low/medium/high).
 * Single-word naming: AutonomySlider
 */

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AutonomyLevel = "read" | "low" | "medium" | "high";

export type AutonomySliderProps = {
  value: AutonomyLevel;
  onChange: (value: AutonomyLevel) => void;
  disabled?: boolean;
  className?: string;
};

const autonomyLevels: AutonomyLevel[] = ["read", "low", "medium", "high"];

const autonomyLabels: Record<AutonomyLevel, string> = {
  read: "Read Only",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const autonomyDescriptions: Record<AutonomyLevel, string> = {
  read: "No execution, read-only access",
  low: "Suggestions only, no execution",
  medium: "Cautious execution with confirmation",
  high: "Full execution with supervision",
};

export function AutonomySlider({
  value,
  onChange,
  disabled = false,
  className,
}: AutonomySliderProps) {
  const currentIndex = autonomyLevels.indexOf(value);
  const maxIndex = autonomyLevels.length - 1;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const index = Number.parseInt(event.target.value, 10);
    const level = autonomyLevels[index];
    if (level) {
      onChange(level);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor="autonomy-slider">Autonomy Level</Label>
        <span className="font-medium text-sm">{autonomyLabels[value]}</span>
      </div>
      <input
        className="w-full"
        disabled={disabled}
        id="autonomy-slider"
        max={maxIndex}
        min={0}
        onChange={handleChange}
        step={1}
        type="range"
        value={currentIndex}
      />
      <p className="text-muted-foreground text-xs">
        {autonomyDescriptions[value]}
      </p>
      <div className="flex justify-between text-muted-foreground text-xs">
        {autonomyLevels.map((level) => (
          <span key={level}>{autonomyLabels[level]}</span>
        ))}
      </div>
    </div>
  );
}
