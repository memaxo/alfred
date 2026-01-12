import type * as React from "react";
import { cn } from "@/lib/utils";

export type TabsListProps = {
  children: React.ReactNode;
  className?: string;
};

export const TabsList = ({
  children,
  className,
  ref,
}: TabsListProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-void-surface/50 p-1 text-biolum-dim",
      className
    )}
    ref={ref}
  >
    {children}
  </div>
);

TabsList.displayName = "TabsList";
