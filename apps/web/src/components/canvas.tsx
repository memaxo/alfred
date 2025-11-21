/**
 * Canvas Component
 *
 * Adapted from ai-sdk.dev/elements/components/canvas
 * Workflow visualization canvas
 */

import { cn } from "@/lib/utils";

type CanvasProps = {
  children: React.ReactNode;
  className?: string;
};

export function Canvas({ children, className }: CanvasProps) {
  return (
    <div
      className={cn(
        "relative min-h-[400px] w-full overflow-auto rounded-lg border bg-muted/20 p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
