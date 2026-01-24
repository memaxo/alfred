/**
 * Desktop UI Performance Utilities
 *
 * Performance budgets:
 * - Window spawn: <10ms
 * - 100 node pan: <16ms (60fps)
 * - localStorage size: <50KB
 */

import { logger } from "@alfred/logger";
import { liteDebounce, liteThrottle } from "@alfred/pacer";

import { DESKTOP_STORAGE_ID } from "@/store/desktop/persist";

/** Max bytes for layout storage (50KB) */
const BUDGET_BYTES = 50 * 1024;

/**
 * Check localStorage size for desktop layout.
 */
export function getLayoutStorageSize(): {
  bytes: number;
  kb: number;
  withinBudget: boolean;
  percentUsed: number;
} {
  if (typeof window === "undefined") {
    return { bytes: 0, kb: 0, withinBudget: true, percentUsed: 0 };
  }

  const data = localStorage.getItem(DESKTOP_STORAGE_ID);
  const bytes = data ? new Blob([data]).size : 0;
  const kb = bytes / 1024;
  const withinBudget = bytes <= BUDGET_BYTES;
  const percentUsed = (bytes / BUDGET_BYTES) * 100;

  return { bytes, kb, withinBudget, percentUsed };
}

/**
 * Log localStorage usage (for debugging).
 */
export function logStorageUsage(): void {
  const { kb, withinBudget, percentUsed } = getLayoutStorageSize();
  const status = withinBudget ? "OK" : "OVER BUDGET";
  logger.debug("desktop_storage_usage", {
    kb: Number(kb.toFixed(2)),
    budgetKb: Number((BUDGET_BYTES / 1024).toFixed(2)),
    percentUsed: Number(percentUsed.toFixed(1)),
    withinBudget,
    status,
  });
}

/**
 * Measure function execution time.
 */
export function measureTime<T>(label: string, fn: () => T, budgetMs = 16): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  const status = duration <= budgetMs ? "OK" : "SLOW";

  if (duration > budgetMs) {
    logger.warn("desktop_performance_budget_exceeded", {
      label,
      durationMs: Number(duration.toFixed(2)),
      budgetMs,
      status,
    });
  }

  return result;
}

/**
 * Measure async function execution time.
 */
export async function measureTimeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  budgetMs = 16
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  const status = duration <= budgetMs ? "OK" : "SLOW";

  if (duration > budgetMs) {
    logger.warn("desktop_performance_budget_exceeded", {
      label,
      durationMs: Number(duration.toFixed(2)),
      budgetMs,
      status,
    });
  }

  return result;
}

/**
 * Edge visibility based on zoom level.
 * Implements edge degradation for performance.
 */
export function getEdgeVisibility(zoom: number): {
  showEdges: boolean;
  showLabels: boolean;
  filterImportant: boolean;
} {
  if (zoom < 0.3) {
    // Tiny LOD - hide all edges
    return { showEdges: false, showLabels: false, filterImportant: false };
  }

  if (zoom < 0.6) {
    // Small LOD - show only important edges, no labels
    return { showEdges: true, showLabels: false, filterImportant: true };
  }

  // Full LOD - show all edges with labels
  return { showEdges: true, showLabels: true, filterImportant: false };
}

/**
 * Important edge kinds that should remain visible at low zoom.
 */
const IMPORTANT_EDGE_KINDS = new Set(["blocks", "depends_on", "contains"]);

/**
 * Filter edges based on zoom level.
 */
export function filterEdgesByZoom<T extends { data?: { kind?: string } }>(
  edges: T[],
  zoom: number
): T[] {
  const { showEdges, filterImportant } = getEdgeVisibility(zoom);

  if (!showEdges) {
    return [];
  }

  if (filterImportant) {
    return edges.filter(
      (e) => e.data?.kind && IMPORTANT_EDGE_KINDS.has(e.data.kind)
    );
  }

  return edges;
}

/**
 * Debounce function for performance-critical updates.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  const debounced = liteDebounce(fn, {
    wait: ms,
    leading: false,
    trailing: true,
  });

  return (...args: Parameters<T>) => {
    debounced(...args);
  };
}

/**
 * Throttle function for rate-limiting updates.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  const throttled = liteThrottle(fn, {
    wait: ms,
    leading: true,
    trailing: true,
  });

  return (...args: Parameters<T>) => {
    throttled(...args);
  };
}
