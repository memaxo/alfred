/**
 * AI Loading Component
 * 
 * Adapted from kokonutui.com/docs/components/ai-loading
 * Animated loading state for AI operations
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  message?: string;
  className?: string;
}

export function Loading({ message = "Processing...", className }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-8", className)}>
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

