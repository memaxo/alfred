import type * as React from "react";

import { cn } from "@/lib/utils";

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}

export const TableCell = ({
  children,
  className,
  colSpan,
  rowSpan,
  ref,
}: TableCellProps & {
  ref?: React.RefObject<HTMLTableCellElement | null>;
}) => (
  <td
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    colSpan={colSpan}
    ref={ref}
    rowSpan={rowSpan}
  >
    {children}
  </td>
);

TableCell.displayName = "TableCell";
