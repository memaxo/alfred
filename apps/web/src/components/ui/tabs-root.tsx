import * as React from "react";

import { cn } from "@/lib/utils";

import { TabsContext, type TabsContextValue } from "./tabs-context";

export interface TabsRootProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const TabsRoot = ({
  children,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  ref,
}: TabsRootProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  const contextValue = React.useMemo<TabsContextValue>(
    () => ({ value: activeValue, onValueChange: handleValueChange }),
    [activeValue, handleValueChange]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("w-full", className)} ref={ref}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

TabsRoot.displayName = " Tabs";
