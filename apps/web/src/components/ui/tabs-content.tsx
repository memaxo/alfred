import * as React from "react";
import { cn } from "@/lib/utils";
import { TabsContext } from "./tabs-context";

export type TabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

export const TabsContent = ({
  value,
  children,
  className,
  ref,
}: TabsContentProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }

  const { value: activeValue } = context;
  const isActive = activeValue === value;

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum focus-visible:ring-offset-2",
        className
      )}
      ref={ref}
    >
      {children}
    </div>
  );
};

TabsContent.displayName = "TabsContent";
