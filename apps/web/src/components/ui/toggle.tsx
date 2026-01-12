import * as React from "react";
import { cn } from "@/lib/utils";

export type ToggleGroupProps = {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  type?: "single" | "multiple";
};

const ToggleGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  type?: "single" | "multiple";
} | null>(null);

export function ToggleGroup({
  children,
  value,
  onValueChange,
  className,
  type = "single",
}: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange, type }}>
      <div className={cn("flex items-center gap-1", className)}>{children}</div>
    </ToggleGroupContext.Provider>
  );
}

export type ToggleGroupItemProps = {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

export function ToggleGroupItem({
  value,
  children,
  disabled = false,
  className,
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("ToggleGroupItem must be used within ToggleGroup");
  }

  const { value: groupValue, onValueChange, type } = context;
  const isActive = groupValue === value;

  const handleClick = () => {
    if (disabled) {
      return;
    }

    if (type === "single") {
      if (isActive) {
        onValueChange?.("");
      } else {
        onValueChange?.(value);
      }
    } else {
      onValueChange?.(value);
    }
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-biolum text-background hover:bg-biolum/90"
          : "border border-white/10 bg-transparent text-biolum hover:bg-void-surface/50",
        "h-10 px-4 py-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {children}
    </button>
  );
}
