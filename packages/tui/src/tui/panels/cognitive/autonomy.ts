/**
 * ALFRED TUI Autonomy Gauge
 *
 * Displays autonomy level with confidence band visualization.
 */

import type { AutonomyState } from "../../subscriptions/cognitive";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";

// ─── Autonomy Level Classification ───────────────────────────────────────────

export type AutonomyLevel = "minimal" | "low" | "medium" | "high" | "full";

export function classifyAutonomy(level: number): AutonomyLevel {
  if (level >= 0.9) {
    return "full";
  }
  if (level >= 0.7) {
    return "high";
  }
  if (level >= 0.5) {
    return "medium";
  }
  if (level >= 0.3) {
    return "low";
  }
  return "minimal";
}

function getAutonomyColor(level: number): string {
  if (level >= 0.7) {
    return colors.success;
  }
  if (level >= 0.5) {
    return colors.primary;
  }
  if (level >= 0.3) {
    return colors.warning;
  }
  return colors.error;
}

function getAutonomyLabel(level: number): string {
  if (level >= 0.9) {
    return "FULL";
  }
  if (level >= 0.7) {
    return "HIGH";
  }
  if (level >= 0.5) {
    return "MED";
  }
  if (level >= 0.3) {
    return "LOW";
  }
  return "MIN";
}

// ─── Autonomy Gauge Rendering ────────────────────────────────────────────────

export function renderAutonomyGauge(
  autonomy: AutonomyState,
  width: number
): string[] {
  const { level, confidence, threshold } = autonomy;
  const color = getAutonomyColor(level);
  const label = getAutonomyLabel(level);

  const lines: string[] = [];

  // Label line
  const labelText = dim("Autonomy");
  const levelText = bold(fg(color)(label));
  const valueText = fg(color)(`${(level * 100).toFixed(0)}%`);
  lines.push(`${labelText}  ${levelText}  ${valueText}`);

  // Gauge bar with threshold marker
  const barWidth = Math.min(width - 4, 30);
  const filledWidth = Math.round(level * barWidth);
  const thresholdPos = Math.round(threshold * barWidth);

  const bar: string[] = [];
  for (let i = 0; i < barWidth; i++) {
    if (i < filledWidth) {
      bar.push(fg(color)(progressChars.filled));
    } else {
      bar.push(dim(progressChars.empty));
    }
  }

  // Add threshold marker
  if (thresholdPos > 0 && thresholdPos < barWidth) {
    bar[thresholdPos] = fg(colors.warning)("│");
  }

  lines.push(`  ${bar.join("")}`);

  // Confidence indicator
  const confColor =
    confidence >= 0.7
      ? colors.success
      : confidence >= 0.4
        ? colors.warning
        : colors.error;
  const confLabel =
    confidence >= 0.7
      ? "confident"
      : confidence >= 0.4
        ? "uncertain"
        : "very uncertain";
  lines.push(
    `  ${dim("Confidence:")} ${fg(confColor)(confLabel)} ${dim(`(${(confidence * 100).toFixed(0)}%)`)}`
  );

  return lines;
}

// ─── Compact Autonomy Display ────────────────────────────────────────────────

export function renderAutonomyCompact(level: number): string {
  const color = getAutonomyColor(level);
  const label = getAutonomyLabel(level);
  return `${dim("A:")}${fg(color)(label)}`;
}

export function renderAutonomyInline(level: number, width: number): string {
  const color = getAutonomyColor(level);
  const label = getAutonomyLabel(level);
  const percent = (level * 100).toFixed(0);

  // Mini bar
  const barWidth = Math.max(5, width - 15);
  const filled = Math.round(level * barWidth);
  const empty = barWidth - filled;

  const bar =
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty));

  return `${dim("Autonomy")} ${bar} ${fg(color)(`${percent}%`)} ${fg(color)(label)}`;
}

// ─── Autonomy with History Sparkline ─────────────────────────────────────────

const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function renderAutonomyWithHistory(
  level: number,
  history: number[],
  width: number
): string[] {
  const lines: string[] = [];

  // Current value
  lines.push(renderAutonomyInline(level, width));

  // History sparkline
  if (history.length > 1) {
    const sparkWidth = Math.min(history.length, width - 10);
    const recentHistory = history.slice(-sparkWidth);

    const sparkline = recentHistory
      .map((v) => {
        const idx = Math.min(Math.floor(v * 8), 7);
        const c =
          v >= 0.7 ? colors.success : v >= 0.4 ? colors.warning : colors.error;
        return fg(c)(SPARKLINE_CHARS[idx] ?? "▁");
      })
      .join("");

    lines.push(`  ${dim("Trend:")} ${sparkline}`);
  }

  return lines;
}

// ─── Threshold Indicator ─────────────────────────────────────────────────────

export function renderThresholdComparison(
  level: number,
  threshold: number
): string {
  const aboveThreshold = level >= threshold;
  const diff = ((level - threshold) * 100).toFixed(0);
  const diffSign = aboveThreshold ? "+" : "";

  if (aboveThreshold) {
    return `${fg(colors.success)("●")} ${dim("Above threshold")} ${fg(colors.success)(`${diffSign}${diff}%`)}`;
  }
  return `${fg(colors.warning)("○")} ${dim("Below threshold")} ${fg(colors.warning)(`${diff}%`)}`;
}
