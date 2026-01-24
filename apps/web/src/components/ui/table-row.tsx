import type * as React from "react";

import { cn } from "@/lib/utils";

export type TableRowProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export const TableRow = ({
  children,
  className,
  onClick,
  ref,
}: TableRowProps & {
  ref?: React.RefObject<HTMLTableRowElement | null>;
}) => (
  <tr
    className={cn(
      "border-white/5 border-b transition-colors hover:bg-void-surface/50 data-[state=selected]:bg-void-surface/80",
      onClick && "cursor-pointer",
      className
    )}
    onClick={onClick}
    ref={ref}
  >
    {children}
  </tr>
);

TableRow.displayName = "TableRow";
