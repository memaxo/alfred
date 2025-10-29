/**
 * Edge Component
 * 
 * Adapted from ai-sdk.dev/elements/components/edge
 * Connects nodes in workflow canvas
 */

import { cn } from "@/lib/utils";

interface EdgeProps {
  from: string;
  to: string;
  label?: string;
  className?: string;
}

export function Edge({ from, to, label, className }: EdgeProps) {
  return (
    <div className={cn("relative", className)}>
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      </svg>
      {label && (
        <div className="relative flex items-center justify-center">
          <span className="rounded bg-background px-2 py-1 text-xs">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

