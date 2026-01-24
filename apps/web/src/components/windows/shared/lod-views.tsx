import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TinyDotProps = {
  color: string;
  shadow?: string;
};

export function TinyDot({ color, shadow }: TinyDotProps) {
  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full transition-all",
        color,
        shadow ?? `shadow-${color.replace("bg-", "")}/50`
      )}
    />
  );
}

type SmallCardProps = {
  icon: ReactNode;
  label: string;
  textColor?: string;
  borderColor?: string;
  hoverColor?: string;
};

export function SmallCard({
  icon,
  label,
  textColor = "text-biolum",
  borderColor = "border-white/20",
  hoverColor = "hover:border-white/40",
}: SmallCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-1",
        "bg-void-surface/60 backdrop-blur transition-all",
        borderColor,
        hoverColor
      )}
    >
      <span className={textColor}>{icon}</span>
      <span className="max-w-[80px] truncate font-medium text-biolum-dim text-xs">
        {label}
      </span>
    </div>
  );
}
