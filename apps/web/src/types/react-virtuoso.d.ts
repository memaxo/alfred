import type { ComponentType, ReactNode } from "react";

export type ListRange = {
  startIndex: number;
  endIndex: number;
};

export type VirtuosoProps<T = unknown> = {
  data?: T[];
  followOutput?: "smooth" | boolean;
  overscan?: number;
  initialTopMostItemIndex?: number;
  itemContent: (index: number, item: T) => ReactNode;
  className?: string;
  rangeChanged?: (range: ListRange) => void;
};

export const Virtuoso: ComponentType<VirtuosoProps>;
