import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DockProps = {
  children: ReactNode;
  className?: string;
};

export function Dock({ children, className }: DockProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-white/5 px-2 py-1",
        className
      )}
    >
      {children}
    </div>
  );
}
