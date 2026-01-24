"use client";

/**
 * VirtualList - Reusable virtualized list component
 */

import type { ReactNode } from "react";

import { Loader2 } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { cn } from "@/lib/utils";

type VirtualListProps<T> = {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  header?: ReactNode;
  headerText?: string;
  className?: string;
  itemClassName?: string;
};

export function VirtualList<T>({
  data,
  renderItem,
  isLoading = false,
  error = null,
  emptyMessage = "No items found",
  header,
  headerText,
  className,
  itemClassName = "px-2 pt-2 last:pb-2",
}: VirtualListProps<T>) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {(header || headerText) && (
        <div className="flex h-9 items-center border-white/5 border-b px-3">
          {header ?? (
            <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
              {isLoading ? "Loading..." : headerText}
            </span>
          )}
        </div>
      )}

      <div className="flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
          </div>
        )}
        {error && (
          <div className="py-2 text-center text-red-400 text-xs">{error}</div>
        )}
        {!(isLoading || error) && data.length === 0 && (
          <div className="py-4 text-center text-biolum-dim text-sm">
            {emptyMessage}
          </div>
        )}
        {!(isLoading || error) && data.length > 0 && (
          <Virtuoso
            className="h-full"
            data={data}
            itemContent={(index, item) => (
              <div className={itemClassName}>{renderItem(item, index)}</div>
            )}
          />
        )}
      </div>
    </div>
  );
}
