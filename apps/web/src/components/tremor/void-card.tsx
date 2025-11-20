import { Card, type CardProps } from "@tremor/react";
import { cn } from "@/lib/utils";

export function VoidCard({ className, children, ...props }: CardProps) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl",
        "shadow-none", // Remove default shadow
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

