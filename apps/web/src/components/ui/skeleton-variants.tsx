import type * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export type SkeletonAvatarProps = {
  className?: string;
};

export function SkeletonAvatar({ className }: SkeletonAvatarProps) {
  return (
    <div
      className={cn(
        "h-10 w-10 animate-pulse rounded-full bg-void-surface/80",
        className
      )}
    />
  );
}

export type SkeletonCardProps = {
  className?: string;
  hasHeader?: boolean;
  hasImage?: boolean;
  lines?: number;
};

export const SkeletonCard = ({
  className,
  hasHeader = true,
  hasImage = false,
  lines = 3,
  ref,
}: SkeletonCardProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn(
      "rounded-xl border border-white/10 bg-void-surface/20 p-4",
      className
    )}
    ref={ref}
  >
    {hasHeader && (
      <div className="mb-4 flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )}

    {hasImage && <Skeleton className="mb-4 h-48 w-full rounded-lg" />}

    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          className={cn(i === lines - 1 ? "w-2/3" : "w-full", "h-4")}
          key={i}
        />
      ))}
    </div>
  </div>
);

SkeletonCard.displayName = "SkeletonCard";

export type SkeletonTableRowProps = {
  cells?: number;
  className?: string;
};

export function SkeletonTableRow({
  cells = 4,
  className,
}: SkeletonTableRowProps) {
  return (
    <tr className={cn("border-white/5 border-b", className)}>
      {Array.from({ length: cells }).map((_, i) => (
        <td className="p-4" key={i}>
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export type SkeletonTableProps = {
  rows?: number;
  cells?: number;
  className?: string;
};

export function SkeletonTable({
  rows = 5,
  cells = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-4 border-white/10 border-b p-4">
        {Array.from({ length: cells }).map((_, i) => (
          <Skeleton className="h-4 w-20" key={i} />
        ))}
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow cells={cells} key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type SkeletonChartProps = {
  bars?: number;
  className?: string;
};

export function SkeletonChart({ bars = 8, className }: SkeletonChartProps) {
  return (
    <div className={cn("flex h-48 items-end gap-2", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const height = Math.random() * 60 + 20;
        return (
          <div className="flex h-full flex-1 items-end" key={i}>
            <Skeleton
              className="w-full animate-pulse"
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export type SkeletonFormProps = {
  fields?: number;
  className?: string;
};

export function SkeletonForm({ fields = 3, className }: SkeletonFormProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div className="space-y-2" key={i}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}
