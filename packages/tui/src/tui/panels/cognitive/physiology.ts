/**
 * ALFRED TUI Physiology Indicators
 *
 * Displays energy, boredom, and frustration levels.
 */

import type { PhysiologyState } from "../../subscriptions/cognitive";
import { colors, progressChars } from "../../theme";
import { dim, fg } from "../../typography";

// ─── Physiology Metrics ──────────────────────────────────────────────────────

type MetricConfig = {
  label: string;
  lowLabel: string;
  highLabel: string;
  goodWhenHigh: boolean;
};

const METRIC_CONFIGS: Record<keyof PhysiologyState, MetricConfig> = {
  energy: {
    label: "Energy",
    lowLabel: "depleted",
    highLabel: "full",
    goodWhenHigh: true,
  },
  boredom: {
    label: "Boredom",
    lowLabel: "engaged",
    highLabel: "bored",
    goodWhenHigh: false,
  },
  frustration: {
    label: "Frustration",
    lowLabel: "calm",
    highLabel: "frustrated",
    goodWhenHigh: false,
  },
};

function getMetricColor(value: number, goodWhenHigh: boolean): string {
  if (goodWhenHigh) {
    if (value >= 0.7) {
      return colors.success;
    }
    if (value >= 0.4) {
      return colors.warning;
    }
    return colors.error;
  }
  // Bad when high
  if (value >= 0.7) {
    return colors.error;
  }
  if (value >= 0.4) {
    return colors.warning;
  }
  return colors.success;
}

export function getMetricStatus(value: number, config: MetricConfig): string {
  if (value >= 0.5) {
    return config.highLabel;
  }
  return config.lowLabel;
}

// ─── Physiology Rendering ────────────────────────────────────────────────────

export function renderPhysiologyMetric(
  name: keyof PhysiologyState,
  value: number,
  width: number
): string {
  const config = METRIC_CONFIGS[name];
  const color = getMetricColor(value, config.goodWhenHigh);

  const barWidth = Math.max(5, Math.min(width - 20, 15));
  const filled = Math.round(value * barWidth);
  const empty = barWidth - filled;

  const bar =
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty));
  const percent = (value * 100).toFixed(0).padStart(3);

  const label = dim(config.label.padEnd(12));
  return `${label}${bar} ${fg(color)(`${percent}%`)}`;
}

export function renderPhysiology(
  physiology: PhysiologyState,
  _width: number
): string {
  return renderPhysiologyCompact(physiology);
}

export function renderPhysiologyIndicators(
  physiology: PhysiologyState,
  width: number
): string[] {
  const lines: string[] = [];

  lines.push(renderPhysiologyMetric("energy", physiology.energy, width));
  lines.push(renderPhysiologyMetric("boredom", physiology.boredom, width));
  lines.push(
    renderPhysiologyMetric("frustration", physiology.frustration, width)
  );

  return lines;
}

// ─── Compact Physiology ──────────────────────────────────────────────────────

export function renderPhysiologyCompact(physiology: PhysiologyState): string {
  const { energy, boredom, frustration } = physiology;

  const eColor = getMetricColor(energy, true);
  const bColor = getMetricColor(boredom, false);
  const fColor = getMetricColor(frustration, false);

  const e = fg(eColor)(`E:${(energy * 100).toFixed(0)}%`);
  const b = fg(bColor)(`B:${(boredom * 100).toFixed(0)}%`);
  const f = fg(fColor)(`F:${(frustration * 100).toFixed(0)}%`);

  return `${e} ${b} ${f}`;
}

// ─── Physiology Status Summary ───────────────────────────────────────────────

export type PhysiologyStatus = "optimal" | "good" | "degraded" | "critical";

export function getPhysiologyStatus(
  physiology: PhysiologyState
): PhysiologyStatus {
  const { energy, boredom, frustration } = physiology;

  // Critical if any metric is very bad
  if (energy < 0.2 || boredom > 0.8 || frustration > 0.8) {
    return "critical";
  }

  // Degraded if any metric is concerning
  if (energy < 0.4 || boredom > 0.6 || frustration > 0.6) {
    return "degraded";
  }

  // Good if metrics are acceptable
  if (energy > 0.6 && boredom < 0.4 && frustration < 0.4) {
    return "optimal";
  }

  return "good";
}

export function renderPhysiologyStatus(physiology: PhysiologyState): string {
  const status = getPhysiologyStatus(physiology);

  switch (status) {
    case "optimal":
      return `${fg(colors.success)("●")} ${dim("Optimal state")}`;
    case "good":
      return `${fg(colors.primary)("●")} ${dim("Good state")}`;
    case "degraded":
      return `${fg(colors.warning)("●")} ${dim("Degraded state")}`;
    case "critical":
      return `${fg(colors.error)("●")} ${dim("Critical state")}`;
  }
}

// ─── Physiology Icons ────────────────────────────────────────────────────────

export function renderPhysiologyIcons(physiology: PhysiologyState): string {
  const { energy, boredom, frustration } = physiology;

  // Energy icon
  let energyIcon: string;
  if (energy > 0.7) {
    energyIcon = fg(colors.success)("⚡");
  } else if (energy > 0.4) {
    energyIcon = fg(colors.warning)("🔋");
  } else {
    energyIcon = fg(colors.error)("🪫");
  }

  // Mood icon based on boredom + frustration
  const mood = (boredom + frustration) / 2;
  let moodIcon: string;
  if (mood < 0.3) {
    moodIcon = fg(colors.success)("😊");
  } else if (mood < 0.6) {
    moodIcon = fg(colors.warning)("😐");
  } else {
    moodIcon = fg(colors.error)("😤");
  }

  return `${energyIcon} ${moodIcon}`;
}

// ─── Physiology Trend ────────────────────────────────────────────────────────

export function renderPhysiologyTrend(
  current: PhysiologyState,
  previous: PhysiologyState | null
): string {
  if (!previous) {
    return "";
  }

  const energyDiff = current.energy - previous.energy;
  const boredDiff = current.boredom - previous.boredom;
  const frustDiff = current.frustration - previous.frustration;

  const trends: string[] = [];

  if (Math.abs(energyDiff) > 0.05) {
    const arrow = energyDiff > 0 ? "↑" : "↓";
    const color = energyDiff > 0 ? colors.success : colors.error;
    trends.push(`${dim("E")}${fg(color)(arrow)}`);
  }

  if (Math.abs(boredDiff) > 0.05) {
    const arrow = boredDiff > 0 ? "↑" : "↓";
    const color = boredDiff < 0 ? colors.success : colors.warning;
    trends.push(`${dim("B")}${fg(color)(arrow)}`);
  }

  if (Math.abs(frustDiff) > 0.05) {
    const arrow = frustDiff > 0 ? "↑" : "↓";
    const color = frustDiff < 0 ? colors.success : colors.error;
    trends.push(`${dim("F")}${fg(color)(arrow)}`);
  }

  return trends.length > 0 ? trends.join(" ") : dim("stable");
}
