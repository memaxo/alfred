import type * as React from "react";

import { cn } from "@/lib/utils";

export type TableHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export const TableHeader = ({
  children,
  className,
  ref,
}: TableHeaderProps & {
  ref?: React.RefObject<HTMLTableSectionElement | null>;
}) => (
  <thead className={cn("[&_tr]:border-b", className)} ref={ref}>
    {children}
  </thead>
);

TableHeader.displayName = "TableHeader";
