/**
 * Breadcrumbs - Path navigation
 */

import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  path: string;
  onNavigate: (path: string) => void;
  className?: string;
}

export function Breadcrumbs({ path, onNavigate, className }: BreadcrumbsProps) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      <button
        className="flex items-center gap-1 rounded px-1 py-0.5 text-biolum-dim hover:bg-white/5 hover:text-biolum"
        onClick={() => onNavigate("/")}
        type="button"
      >
        <Home className="h-4 w-4" />
      </button>

      {parts.map((part, idx) => {
        const partPath = `/${parts.slice(0, idx + 1).join("/")}`;
        const isLast = idx === parts.length - 1;

        return (
          <div className="flex items-center gap-1" key={partPath}>
            <ChevronRight className="h-4 w-4 text-biolum-dim" />
            <button
              className={cn(
                "rounded px-1 py-0.5",
                isLast
                  ? "font-medium text-biolum"
                  : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
              )}
              onClick={() => onNavigate(partPath)}
              type="button"
            >
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
}
