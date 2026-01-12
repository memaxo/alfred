import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GridProps = {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
};

export function Grid({ children, cols = 3, className }: GridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 md:grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
