/**
 * ALFRED TUI Latency Visualization
 *
 * Displays latency metrics with percentile breakdowns.
 */

import type {
  LatencyMetrics,
  RouterMetrics,
} from "../../subscriptions/metrics";
import { colors, progressChars } from "../../theme";
import { dim, fg } from "../../typography";

// ─── Latency Thresholds ──────────────────────────────────────────────────────

const LATENCY_THRESHOLDS = {
  excellent: 50, // < 50ms
  good: 100, // < 100ms
  acceptable: 250, // < 250ms
  slow: 500, // < 500ms
  // > 500ms is critical
};

function getLatencyColor(ms: number): string {
  if (ms < LATENCY_THRESHOLDS.excellent) {
    return colors.success;
  }
  if (ms < LATENCY_THRESHOLDS.good) {
    return colors.primary;
  }
  if (ms < LATENCY_THRESHOLDS.acceptable) {
    return colors.warning;
  }
  if (ms < LATENCY_THRESHOLDS.slow) {
    return colors.error;
  }
  return colors.error;
}

export function getLatencyLabel(ms: number): string {
  if (ms < LATENCY_THRESHOLDS.excellent) {
    return "excellent";
  }
  if (ms < LATENCY_THRESHOLDS.good) {
    return "good";
  }
  if (ms < LATENCY_THRESHOLDS.acceptable) {
    return "ok";
  }
  if (ms < LATENCY_THRESHOLDS.slow) {
    return "slow";
  }
  return "critical";
}

// ─── Latency Formatting ──────────────────────────────────────────────────────

export function formatLatency(ms: number): string {
  if (ms < 1) {
    return "<1ms";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function coloredLatency(ms: number): string {
  const color = getLatencyColor(ms);
  return fg(color)(formatLatency(ms));
}

// ─── Latency Bar ─────────────────────────────────────────────────────────────

export function renderLatencyBar(
  ms: number,
  maxMs: number,
  width: number
): string {
  const color = getLatencyColor(ms);
  const ratio = Math.min(ms / maxMs, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  return (
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty))
  );
}

// ─── Latency Metrics Display ─────────────────────────────────────────────────

export function renderLatencyMetrics(
  metrics: LatencyMetrics,
  width: number
): string[] {
  const lines: string[] = [];
  const maxLatency = Math.max(metrics.p99, 500); // At least 500ms scale

  // P50 (median)
  const p50Bar = renderLatencyBar(metrics.p50, maxLatency, width - 20);
  lines.push(`${dim("p50")} ${p50Bar} ${coloredLatency(metrics.p50)}`);

  // P99
  const p99Bar = renderLatencyBar(metrics.p99, maxLatency, width - 20);
  lines.push(`${dim("p99")} ${p99Bar} ${coloredLatency(metrics.p99)}`);

  return lines;
}

export function renderLatencyCompact(metrics: LatencyMetrics): string {
  return `${dim("p50:")}${coloredLatency(metrics.p50)} ${dim("p99:")}${coloredLatency(metrics.p99)}`;
}

// ─── Router Latency Table ────────────────────────────────────────────────────

export function renderRouterLatencyTable(
  routers: RouterMetrics[],
  width: number,
  maxRows = 10
): string[] {
  const lines: string[] = [];

  // Sort by p99 latency descending (slowest first)
  const sorted = [...routers].sort((a, b) => b.latency.p99 - a.latency.p99);
  const visible = sorted.slice(0, maxRows);

  // Calculate column widths
  const nameWidth = Math.min(15, width - 30);

  // Header
  lines.push(dim(`${"Router".padEnd(nameWidth)} p50      p99`));
  lines.push(dim("─".repeat(width)));

  for (const router of visible) {
    const name = router.name.slice(0, nameWidth).padEnd(nameWidth);
    const p50 = coloredLatency(router.latency.p50).padEnd(8);
    const p99 = coloredLatency(router.latency.p99);

    lines.push(`${name} ${p50} ${p99}`);
  }

  if (routers.length > maxRows) {
    lines.push(dim(`... and ${routers.length - maxRows} more routers`));
  }

  return lines;
}

// ─── Simple Latency Rendering ─────────────────────────────────────────────────

type SimpleLatencyData = {
  router: string;
  p50: number;
  p95: number;
  p99: number;
};

export function renderLatency(
  data: SimpleLatencyData[],
  width: number
): string[] {
  if (data.length === 0) {
    return [dim("No latency data")];
  }

  const lines: string[] = [];

  // Header
  lines.push(dim(`${"Router".padEnd(15)} p50      p95      p99`));
  lines.push(dim("─".repeat(width)));

  for (const item of data) {
    const name = item.router.slice(0, 15).padEnd(15);
    const p50 = coloredLatency(item.p50).padEnd(8);
    const p95 = coloredLatency(item.p95).padEnd(8);
    const p99 = coloredLatency(item.p99);

    lines.push(`${name} ${p50} ${p95} ${p99}`);
  }

  return lines;
}

// ─── Latency Distribution ────────────────────────────────────────────────────

export function renderLatencyDistribution(
  samples: number[],
  width: number
): string[] {
  const lines: string[] = [];

  if (samples.length === 0) {
    lines.push(dim("No samples"));
    return lines;
  }

  // Calculate buckets
  const buckets = [50, 100, 250, 500, 1000, 2000];
  const counts = new Map<number, number>();

  for (const bucket of buckets) {
    counts.set(bucket, 0);
  }

  for (const sample of samples) {
    for (const bucket of buckets) {
      if (sample <= bucket) {
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
        break;
      }
    }
  }

  const maxCount = Math.max(...counts.values());

  // Render histogram
  for (const bucket of buckets) {
    const count = counts.get(bucket) ?? 0;
    const percent = samples.length > 0 ? (count / samples.length) * 100 : 0;
    const barWidth = Math.round((count / maxCount) * (width - 20));

    const label = `≤${bucket}ms`.padEnd(8);
    const bar = fg(getLatencyColor(bucket))("█".repeat(barWidth));
    const percentStr = `${percent.toFixed(0)}%`.padStart(4);

    lines.push(`${dim(label)} ${bar} ${dim(percentStr)}`);
  }

  return lines;
}

// ─── Latency Trend ───────────────────────────────────────────────────────────

export function getLatencyTrend(
  current: LatencyMetrics,
  previous: LatencyMetrics
): { direction: "up" | "down" | "stable"; percent: number } {
  const currentAvg = (current.p50 + current.p99) / 2;
  const previousAvg = (previous.p50 + previous.p99) / 2;

  if (previousAvg === 0) {
    return { direction: "stable", percent: 0 };
  }

  const percent = ((currentAvg - previousAvg) / previousAvg) * 100;

  if (Math.abs(percent) < 5) {
    return { direction: "stable", percent };
  }

  return {
    direction: percent > 0 ? "up" : "down",
    percent: Math.abs(percent),
  };
}

export function renderLatencyTrend(
  current: LatencyMetrics,
  previous: LatencyMetrics
): string {
  const trend = getLatencyTrend(current, previous);

  if (trend.direction === "stable") {
    return dim("→ stable");
  }

  const arrow = trend.direction === "up" ? "↑" : "↓";
  const color = trend.direction === "up" ? colors.error : colors.success;
  const label = trend.direction === "up" ? "slower" : "faster";

  return `${fg(color)(arrow)} ${fg(color)(`${trend.percent.toFixed(0)}%`)} ${dim(label)}`;
}
