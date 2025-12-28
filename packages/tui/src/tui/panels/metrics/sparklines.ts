/**
 * ALFRED TUI Sparkline Charts
 *
 * ASCII sparkline visualization for time-series data.
 */

import { colors, sparklineChars } from "../../theme";
import { dim, fg } from "../../typography";

// ─── Sparkline Configuration ─────────────────────────────────────────────────

export type SparklineOptions = {
  width?: number;
  color?: string;
  min?: number;
  max?: number;
  showMinMax?: boolean;
  label?: string;
};

// ─── Basic Sparkline ─────────────────────────────────────────────────────────

export function sparkline(
  values: number[],
  options: SparklineOptions = {}
): string {
  if (values.length === 0) {
    return "";
  }

  const {
    width = values.length,
    color = colors.primary,
    min: forcedMin,
    max: forcedMax,
  } = options;

  // Normalize to target width
  const normalizedValues = normalizeToWidth(values, width);

  // Calculate range
  const min = forcedMin ?? Math.min(...normalizedValues);
  const max = forcedMax ?? Math.max(...normalizedValues);
  const range = max - min || 1;

  // Map to sparkline characters
  const chars = normalizedValues.map((value) => {
    const normalized = (value - min) / range;
    const index = Math.min(Math.floor(normalized * 8), 7);
    return sparklineChars[index] ?? sparklineChars[0] ?? "▁";
  });

  return fg(color)(chars.join(""));
}

function normalizeToWidth(values: number[], targetWidth: number): number[] {
  if (values.length <= targetWidth) {
    return values;
  }

  // Sample values to fit target width
  const result: number[] = [];
  const step = values.length / targetWidth;

  for (let i = 0; i < targetWidth; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);
    const slice = values.slice(startIdx, endIdx);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }

  return result;
}

// ─── Labeled Sparkline ───────────────────────────────────────────────────────

export function labeledSparkline(
  label: string,
  values: number[],
  options: SparklineOptions = {}
): string {
  const spark = sparkline(values, options);
  const current = values.at(-1) ?? 0;
  const formatted = formatNumber(current);

  return `${dim(label)} ${spark} ${formatted}`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

// ─── Sparkline with Stats ────────────────────────────────────────────────────

export type SparklineStats = {
  min: number;
  max: number;
  avg: number;
  current: number;
};

export function sparklineWithStats(
  values: number[],
  width: number,
  color: string = colors.primary
): { line: string; stats: SparklineStats } {
  if (values.length === 0) {
    return {
      line: dim("─".repeat(width)),
      stats: { min: 0, max: 0, avg: 0, current: 0 },
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const current = values.at(-1) ?? 0;

  const line = sparkline(values, { width, color, min, max });

  return {
    line,
    stats: { min, max, avg, current },
  };
}

export function renderSparklineWithStats(
  label: string,
  values: number[],
  width: number,
  options: SparklineOptions = {}
): string[] {
  const lines: string[] = [];
  const { line, stats } = sparklineWithStats(values, width - 10, options.color);

  // Main line with label
  const currentFormatted = formatNumber(stats.current);
  lines.push(`${dim(label.padEnd(12))} ${line} ${currentFormatted}`);

  // Stats line (if showing)
  if (options.showMinMax) {
    const minFormatted = formatNumber(stats.min);
    const maxFormatted = formatNumber(stats.max);
    const avgFormatted = formatNumber(stats.avg);
    lines.push(
      dim(
        `             min:${minFormatted} max:${maxFormatted} avg:${avgFormatted}`
      )
    );
  }

  return lines;
}

// ─── Multi-color Sparkline ───────────────────────────────────────────────────

export function coloredSparkline(
  values: number[],
  thresholds: { value: number; color: string }[],
  width: number = values.length
): string {
  if (values.length === 0) {
    return "";
  }

  const normalizedValues = normalizeToWidth(values, width);
  const min = Math.min(...normalizedValues);
  const max = Math.max(...normalizedValues);
  const range = max - min || 1;

  // Sort thresholds descending
  const sortedThresholds = [...thresholds].sort((a, b) => b.value - a.value);

  const chars = normalizedValues.map((value) => {
    const normalized = (value - min) / range;
    const index = Math.min(Math.floor(normalized * 8), 7);
    const char = sparklineChars[index] ?? "▁";

    // Find color based on value
    let color: string = colors.muted;
    for (const threshold of sortedThresholds) {
      if (value >= threshold.value) {
        color = threshold.color;
        break;
      }
    }

    return fg(color)(char);
  });

  return chars.join("");
}

// ─── Comparison Sparkline ────────────────────────────────────────────────────

export function comparisonSparkline(
  current: number[],
  previous: number[],
  width: number
): string[] {
  const lines: string[] = [];

  const currentLine = sparkline(current, { width, color: colors.primary });
  const previousLine = sparkline(previous, { width, color: colors.muted });

  lines.push(`${dim("Now:")}  ${currentLine}`);
  lines.push(`${dim("Prev:")} ${previousLine}`);

  // Delta indicator
  const currentAvg = current.reduce((a, b) => a + b, 0) / current.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
  const delta = ((currentAvg - previousAvg) / previousAvg) * 100;

  if (!Number.isNaN(delta) && Number.isFinite(delta)) {
    const deltaColor = delta >= 0 ? colors.success : colors.error;
    const deltaSign = delta >= 0 ? "+" : "";
    lines.push(
      `${dim("Delta:")} ${fg(deltaColor)(`${deltaSign}${delta.toFixed(1)}%`)}`
    );
  }

  return lines;
}

// ─── Inline Sparkline ────────────────────────────────────────────────────────

export function inlineSparkline(values: number[], maxWidth = 10): string {
  const width = Math.min(values.length, maxWidth);
  const recentValues = values.slice(-width);
  return sparkline(recentValues, { width });
}
