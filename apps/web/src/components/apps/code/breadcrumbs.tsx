"use client";

import { ChevronRight, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

type BreadcrumbsProps = {
  path: string;
  className?: string;
  onNavigate?: (path: string) => void;
};

export function Breadcrumbs({ path, className, onNavigate }: BreadcrumbsProps) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div
      className={cn(
        "flex h-6 items-center gap-1 overflow-x-auto border-white/5 border-b bg-void px-2 text-xs",
        className
      )}
    >
      <FileCode className="h-3 w-3 flex-shrink-0 text-biolum-dim" />
      {parts.map((part, index) => {
        const fullPath = `/${parts.slice(0, index + 1).join("/")}`;
        const isLast = index === parts.length - 1;

        return (
          <span className="flex items-center gap-1" key={fullPath}>
            {index > 0 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-biolum-dim/50" />
            )}
            <button
              className={cn(
                "truncate transition-colors hover:text-biolum",
                isLast ? "text-biolum" : "text-biolum-dim"
              )}
              onClick={() => onNavigate?.(fullPath)}
              type="button"
            >
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}
