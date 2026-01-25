import * as React from "react";

import { cn } from "@/lib/utils";

import { TabsContext } from "./tabs-context";

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const TabsTrigger = ({
  value,
  children,
  disabled,
  className,
  onClick,
  ref,
}: TabsTriggerProps & {
  ref?: React.RefObject<HTMLButtonElement | null>;
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const { value: activeValue, onValueChange } = context;
  const isActive = activeValue === value;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-biolum/10 text-biolum shadow-sm"
          : "text-biolum-dim hover:bg-void-surface/80 hover:text-biolum",
        className
      )}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (!disabled) {
          onValueChange(value);
        }
      }}
      ref={ref}
      type="button"
    >
      {children}
    </button>
  );
};

TabsTrigger.displayName = "TabsTrigger";
