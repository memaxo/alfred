/**
 * Edge Component
 *
 * Adapted from ai-sdk.dev/elements/components/edge
 * Connects nodes in workflow canvas
 */

import { cn } from "@/lib/utils";

type EdgeProps = {
  from: string;
  to: string;
  label?: string;
  className?: string;
};

export function Edge({ label, className }: EdgeProps) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-label="Connection edge"
        className="pointer-events-none absolute inset-0 h-full w-full"
        role="img"
      >
        <title>Connection edge</title>
        <line
          stroke="currentColor"
          strokeDasharray="5,5"
          strokeWidth="2"
          x1="0"
          x2="100%"
          y1="50%"
          y2="50%"
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
