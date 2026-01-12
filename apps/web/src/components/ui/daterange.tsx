"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DateField } from "./date";

export type DateRangeValue = {
  from?: Date;
  to?: Date;
};

export type DateRangeFieldProps = {
  value?: DateRangeValue;
  onChange?: (next: DateRangeValue) => void;
  disabled?: boolean;
  className?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
};

export function DateRangeField({
  value,
  onChange,
  disabled,
  className,
  fromPlaceholder = "Start date",
  toPlaceholder = "End date",
}: DateRangeFieldProps) {
  const current = useMemo(
    () => ({ from: value?.from, to: value?.to }),
    [value?.from, value?.to]
  );

  return (
    <div className={cn("grid gap-2 md:grid-cols-2", className)}>
      <DateField
        disabled={disabled}
        onChange={(from) => onChange?.({ ...current, from })}
        placeholder={fromPlaceholder}
        value={current.from}
      />
      <DateField
        disabled={disabled}
        onChange={(to) => onChange?.({ ...current, to })}
        placeholder={toPlaceholder}
        value={current.to}
      />
    </div>
  );
}
