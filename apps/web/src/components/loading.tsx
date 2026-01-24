/**
 * AI Loading Component
 *
 * Adapted from kokonutui.com/docs/components/ai-loading
 * Animated loading state for AI operations
 */

import { Loader2 } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type LoadingProps = {
  message?: string;
  className?: string;
};

export function Loading({
  message = "Processing...",
  className,
}: LoadingProps) {
  const reduced = useReducedMotion();

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8",
        className
      )}
      role="status"
    >
      <Loader2
        className={cn("size-8 text-primary", !reduced && "animate-spin")}
      />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
