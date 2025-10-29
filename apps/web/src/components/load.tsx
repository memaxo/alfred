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
    <div
      className={cn("flex items-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

