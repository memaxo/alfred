import type { ComponentType, ReactNode } from "react";

export interface ListRange {
  startIndex: number;
  endIndex: number;
}

export interface VirtuosoProps<T = unknown> {
  data?: T[];
  followOutput?: "smooth" | boolean;
  overscan?: number;
  initialTopMostItemIndex?: number;
  itemContent: (index: number, item: T) => ReactNode;
  className?: string;
  rangeChanged?: (range: ListRange) => void;
}

export const Virtuoso: ComponentType<VirtuosoProps>;
