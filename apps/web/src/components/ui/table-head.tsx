import type * as React from "react";
import { cn } from "@/lib/utils";

export type TableHeadProps = {
  children: React.ReactNode;
  className?: string;
};

export const TableHead = ({
  children,
  className,
  ref,
}: TableHeadProps & {
  ref?: React.RefObject<HTMLTableCellElement | null>;
}) => (
  <th
    className={cn(
      "h-10 px-4 text-left align-middle font-medium text-biolum-dim [&:has([role=checkbox])]:pr-0",
      className
    )}
    ref={ref}
  >
    {children}
  </th>
);

TableHead.displayName = "TableHead";
