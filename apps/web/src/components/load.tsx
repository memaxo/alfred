/**
 * Loader Component
 *
 * Adapted from ai-sdk.dev/elements/components/loader
 * Displays loading state during agent operations
 */

import { cn } from "@/lib/utils";

interface LoadProps {
  message?: string;
  className?: string;
}

export function Load({ message = "Loading...", className }: LoadProps) {
  return (
    <output
      aria-label="Loading"
      aria-live="polite"
      className={cn("flex items-center gap-3", className)}
    >
      <div
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
      <span className="text-muted-foreground text-sm">{message}</span>
    </output>
  );
}
