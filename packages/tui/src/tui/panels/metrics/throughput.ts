/**
 * ALFRED TUI Throughput Visualization
 *
 * Displays request rates and throughput metrics.
 */

import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { coloredSparkline, sparkline } from "./sparklines";

// ─── Throughput Formatting ───────────────────────────────────────────────────

export function formatRate(perMinute: number): string {
  if (perMinute < 1) {
    return "<1/min";
  }
  if (perMinute < 60) {
    return `${Math.round(perMinute)}/min`;
  }
  const perSecond = perMinute / 60;
  if (perSecond < 100) {
    return `${perSecond.toFixed(1)}/s`;
  }
  return `${Math.round(perSecond)}/s`;
}

export function formatCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }
  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${(count / 1_000_000).toFixed(1)}M`;
}

// ─── Request Rate Display ────────────────────────────────────────────────────

export function renderRequestRate(
  requestsPerMinute: number,
  history: number[],
  width: number
): string[] {
  const lines: string[] = [];

  // Current rate with sparkline
  const spark = sparkline(history, {
    width: Math.min(width - 25, 20),
    color: colors.primary,
  });
  const rate = formatRate(requestsPerMinute);
  lines.push(`${dim("Requests")} ${spark} ${bold(fg(colors.primary)(rate))}`);

  // Rate classification
  const classification = classifyRate(requestsPerMinute);
  lines.push(`  ${dim("Load:")} ${classification}`);

  return lines;
}

function classifyRate(perMinute: number): string {
  if (perMinute < 10) {
    return fg(colors.muted)("idle");
  }
  if (perMinute < 50) {
    return fg(colors.success)("low");
  }
  if (perMinute < 200) {
    return fg(colors.primary)("normal");
  }
  if (perMinute < 500) {
    return fg(colors.warning)("high");
  }
  return fg(colors.error)("very high");
}

// ─── Error Rate ──────────────────────────────────────────────────────────────

export function renderErrorRate(
  errorsPerMinute: number,
  totalPerMinute: number,
  history: number[]
): string[] {
  const lines: string[] = [];

  const errorPercent =
    totalPerMinute > 0 ? (errorsPerMinute / totalPerMinute) * 100 : 0;

  const errorColor =
    errorPercent > 5
      ? colors.error
      : errorPercent > 1
        ? colors.warning
        : colors.success;

  // Color sparkline by error rate
  const spark = coloredSparkline(
    history,
    [
      { value: 5, color: colors.error },
      { value: 1, color: colors.warning },
      { value: 0, color: colors.success },
    ],
    15
  );

  lines.push(
    `${dim("Errors")} ${spark} ${fg(errorColor)(`${errorPercent.toFixed(1)}%`)} ${dim(`(${formatRate(errorsPerMinute)})`)}`
  );

  return lines;
}

// ─── Throughput Summary ──────────────────────────────────────────────────────

export type ThroughputSummary = {
  requests: number;
  errors: number;
  successRate: number;
  avgLatencyMs: number;
};

export function renderThroughputSummary(
  summary: ThroughputSummary,
  width: number
): string[] {
  const lines: string[] = [];

  // Success rate bar
  const successColor =
    summary.successRate >= 99
      ? colors.success
      : summary.successRate >= 95
        ? colors.warning
        : colors.error;

  const barWidth = Math.min(width - 25, 20);
  const filled = Math.round((summary.successRate / 100) * barWidth);
  const bar =
    fg(successColor)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(barWidth - filled));

  lines.push(
    `${dim("Success")} ${bar} ${fg(successColor)(`${summary.successRate.toFixed(1)}%`)}`
  );

  // Summary stats
  const stats = [
    `${formatCount(summary.requests)} req`,
    `${formatCount(summary.errors)} err`,
    `${summary.avgLatencyMs.toFixed(0)}ms avg`,
  ];
  lines.push(`  ${dim(stats.join(" • "))}`);

  return lines;
}

// ─── Rate Comparison ─────────────────────────────────────────────────────────

export function renderRateComparison(
  current: number,
  previous: number
): string {
  if (previous === 0) {
    return formatRate(current);
  }

  const change = ((current - previous) / previous) * 100;
  const arrow = change >= 0 ? "↑" : "↓";
  const changeColor =
    Math.abs(change) < 10
      ? colors.muted
      : change >= 0
        ? colors.success
        : colors.error;

  return `${formatRate(current)} ${fg(changeColor)(`${arrow}${Math.abs(change).toFixed(0)}%`)}`;
}

// ─── Throughput Gauge ────────────────────────────────────────────────────────

export function renderThroughputGauge(
  current: number,
  max: number,
  width: number
): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const color =
    ratio > 0.9 ? colors.error : ratio > 0.7 ? colors.warning : colors.success;

  const bar =
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty));
  const percent = (ratio * 100).toFixed(0);

  return `${bar} ${fg(color)(`${percent}%`)} ${dim(`of ${formatRate(max)}`)}`;
}

// ─── Connections Display ─────────────────────────────────────────────────────

export function renderConnections(active: number, max = 100): string {
  const ratio = active / max;
  const color =
    ratio > 0.9 ? colors.error : ratio > 0.7 ? colors.warning : colors.success;

  return `${dim("Connections:")} ${fg(color)(active.toString())}${dim(`/${max}`)}`;
}

// ─── Resource Usage ──────────────────────────────────────────────────────────

export function renderResourceUsage(
  memoryMb: number,
  cpuPercent: number
): string[] {
  const lines: string[] = [];

  // Memory
  const memColor = memoryMb > 500 ? colors.warning : colors.success;
  lines.push(`${dim("Memory:")} ${fg(memColor)(`${memoryMb}MB`)}`);

  // CPU
  const cpuColor =
    cpuPercent > 80
      ? colors.error
      : cpuPercent > 50
        ? colors.warning
        : colors.success;
  lines.push(`${dim("CPU:")} ${fg(cpuColor)(`${cpuPercent}%`)}`);

  return lines;
}
