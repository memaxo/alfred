"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type ChoiceProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  options: ChoiceOption[];
  className?: string;
  layout?: "row" | "col";
};

export function Choice({
  value,
  onValueChange,
  options,
  className,
  layout = "row",
}: ChoiceProps) {
  return (
    <RadioGroup.Root
      className={cn(
        "grid gap-2",
        layout === "row" ? "grid-cols-3" : "grid-cols-1",
        className
      )}
      onValueChange={onValueChange}
      value={value}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          className={cn(
            "group rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum/40",
            "data-[state=checked]:border-biolum/40 data-[state=checked]:bg-biolum/10",
            opt.disabled && "pointer-events-none opacity-50"
          )}
          disabled={opt.disabled}
          key={opt.value}
          value={opt.value}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-sm text-white/90">
                {opt.label}
              </div>
              {opt.description && (
                <div className="mt-0.5 line-clamp-2 text-[11px] text-white/45">
                  {opt.description}
                </div>
              )}
            </div>
            <div
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0 rounded-full border border-white/20",
                "group-data-[state=checked]:border-biolum group-data-[state=checked]:bg-biolum"
              )}
            />
          </div>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
