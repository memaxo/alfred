import type { ReactNode } from "react";

type NodeLODTinyProps = {
  color: string; // e.g. "bg-indigo-500"
  shadow: string; // e.g. "shadow-indigo-500/50"
  className?: string;
};

export function NodeLODTiny({ color, shadow, className }: NodeLODTinyProps) {
  return (
    <div
      className={`flex h-3 w-3 items-center justify-center rounded-full bg-opacity-40 backdrop-blur-sm ${color} ${className ?? ""}`}
    >
      <div
        className={`h-1.5 w-1.5 rounded-full bg-opacity-100 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${color} ${shadow}`}
      />
    </div>
  );
}

type NodeLODSmallProps = {
  label: string;
  icon: ReactNode;
  borderColor: string; // e.g. "border-indigo-500/30"
  textColor: string; // e.g. "text-indigo-400"
  hoverColor?: string; // e.g. "hover:border-indigo-500/50"
  className?: string;
};

export function NodeLODSmall({
  label,
  icon,
  borderColor,
  textColor,
  hoverColor,
  className,
}: NodeLODSmallProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border bg-void-surface/40 px-3 py-1 backdrop-blur-md transition-colors ${borderColor} ${hoverColor ?? ""} ${className ?? ""}`}
    >
      <span className={textColor}>{icon}</span>
      <span
        className={`max-w-[120px] truncate font-medium text-[10px] tracking-tight ${textColor.replace("400", "300")}`}
      >
        {label}
      </span>
    </div>
  );
}
