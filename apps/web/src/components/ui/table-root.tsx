import type * as React from "react";
import { cn } from "@/lib/utils";

export type TableRootProps = {
  children: React.ReactNode;
  className?: string;
};

export const TableRoot = ({
  children,
  className,
  ref,
}: TableRootProps & {
  ref?: React.RefObject<HTMLTableElement | null>;
}) => (
  <div className="relative w-full overflow-auto">
    <table className={cn("w-full caption-bottom text-sm", className)} ref={ref}>
      {children}
    </table>
  </div>
);

TableRoot.displayName = "Table";
