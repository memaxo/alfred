import { Badge, type BadgeProps } from "@tremor/react";
import { cn } from "@/lib/utils";

export type BiolumBadgeVariant = "default" | "success" | "warning" | "error";

export interface BiolumBadgeProps extends Omit<BadgeProps, "color"> {
  variant?: BiolumBadgeVariant;
}

const variantStyles: Record<BiolumBadgeVariant, string> = {
  default: "bg-biolum/20 text-biolum border-biolum/30",
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

const glowStyles: Record<BiolumBadgeVariant, string> = {
  default: "shadow-[0_0_10px_oklch(0.99_0_0_/_0.2)]",
  success: "shadow-[0_0_10px_rgb(16_185_129_/_0.2)]",
  warning: "shadow-[0_0_10px_rgb(245_158_11_/_0.2)]",
  error: "shadow-[0_0_10px_rgb(239_68_68_/_0.2)]",
};

export function BiolumBadge({
  variant = "default",
  className,
  children,
  ...props
}: BiolumBadgeProps) {
  return (
    <Badge
      className={cn(
        variantStyles[variant],
        glowStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

