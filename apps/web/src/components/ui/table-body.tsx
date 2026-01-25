import type * as React from "react";

import { cn } from "@/lib/utils";

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody = ({
  children,
  className,
  ref,
}: TableBodyProps & {
  ref?: React.RefObject<HTMLTableSectionElement | null>;
}) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} ref={ref}>
    {children}
  </tbody>
);

TableBody.displayName = "TableBody";
