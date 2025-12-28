/**
 * ALFRED TUI Voice Latency Display
 *
 * Shows STT and TTS latency metrics.
 */

import type { VoiceLatencyStats } from "../../subscriptions/voice";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";

// ─── Latency Thresholds ──────────────────────────────────────────────────────

const STT_THRESHOLDS = {
  excellent: 100,
  good: 200,
  acceptable: 400,
  slow: 800,
};

const TTS_THRESHOLDS = {
  excellent: 50,
  good: 100,
  acceptable: 200,
  slow: 400,
};

function getLatencyColor(
  ms: number,
  thresholds: typeof STT_THRESHOLDS
): string {
  if (ms < thresholds.excellent) {
    return colors.success;
  }
  if (ms < thresholds.good) {
    return colors.primary;
  }
  if (ms < thresholds.acceptable) {
    return colors.warning;
  }
  return colors.error;
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

// ─── Latency Bar ─────────────────────────────────────────────────────────────

export function renderLatencyBar(
  ms: number,
  maxMs: number,
  width: number,
  thresholds: typeof STT_THRESHOLDS
): string {
  const color = getLatencyColor(ms, thresholds);
  const ratio = Math.min(ms / maxMs, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  return (
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty))
  );
}

// ─── Latency Display ─────────────────────────────────────────────────────────

export function renderVoiceLatency(
  stats: VoiceLatencyStats,
  _width: number
): string[] {
  const lines: string[] = [];

  // STT Latency
  lines.push(bold(dim("STT Latency")));
  const sttP50Color = getLatencyColor(stats.sttP50, STT_THRESHOLDS);
  const sttP99Color = getLatencyColor(stats.sttP99, STT_THRESHOLDS);

  lines.push(`  ${dim("p50")} ${fg(sttP50Color)(formatLatency(stats.sttP50))}`);
  lines.push(`  ${dim("p99")} ${fg(sttP99Color)(formatLatency(stats.sttP99))}`);

  lines.push("");

  // TTS Latency
  lines.push(bold(dim("TTS Latency")));
  const ttsP50Color = getLatencyColor(stats.ttsP50, TTS_THRESHOLDS);
  const ttsP99Color = getLatencyColor(stats.ttsP99, TTS_THRESHOLDS);

  lines.push(`  ${dim("p50")} ${fg(ttsP50Color)(formatLatency(stats.ttsP50))}`);
  lines.push(`  ${dim("p99")} ${fg(ttsP99Color)(formatLatency(stats.ttsP99))}`);

  return lines;
}

export function renderVoiceLatencyCompact(stats: VoiceLatencyStats): string {
  const sttColor = getLatencyColor(stats.sttP50, STT_THRESHOLDS);
  const ttsColor = getLatencyColor(stats.ttsP50, TTS_THRESHOLDS);

  return `${dim("STT:")}${fg(sttColor)(formatLatency(stats.sttP50))} ${dim("TTS:")}${fg(ttsColor)(formatLatency(stats.ttsP50))}`;
}

// ─── Latency Bars ────────────────────────────────────────────────────────────

export function renderVoiceLatencyBars(
  stats: VoiceLatencyStats,
  width: number
): string[] {
  const lines: string[] = [];
  const barWidth = Math.min(width - 20, 20);
  const maxLatency = 1000; // 1 second scale

  // STT
  const sttBar = renderLatencyBar(
    stats.sttP50,
    maxLatency,
    barWidth,
    STT_THRESHOLDS
  );
  lines.push(`${dim("STT p50")} ${sttBar} ${formatLatency(stats.sttP50)}`);

  const sttP99Bar = renderLatencyBar(
    stats.sttP99,
    maxLatency,
    barWidth,
    STT_THRESHOLDS
  );
  lines.push(`${dim("STT p99")} ${sttP99Bar} ${formatLatency(stats.sttP99)}`);

  // TTS
  const ttsBar = renderLatencyBar(
    stats.ttsP50,
    maxLatency,
    barWidth,
    TTS_THRESHOLDS
  );
  lines.push(`${dim("TTS p50")} ${ttsBar} ${formatLatency(stats.ttsP50)}`);

  const ttsP99Bar = renderLatencyBar(
    stats.ttsP99,
    maxLatency,
    barWidth,
    TTS_THRESHOLDS
  );
  lines.push(`${dim("TTS p99")} ${ttsP99Bar} ${formatLatency(stats.ttsP99)}`);

  return lines;
}

// ─── Latency Summary ─────────────────────────────────────────────────────────

export type LatencySummary = {
  sttHealth: "good" | "degraded" | "poor";
  ttsHealth: "good" | "degraded" | "poor";
  overall: "good" | "degraded" | "poor";
};

export function calculateLatencySummary(
  stats: VoiceLatencyStats
): LatencySummary {
  const getSttHealth = (): "good" | "degraded" | "poor" => {
    if (stats.sttP99 < STT_THRESHOLDS.good) {
      return "good";
    }
    if (stats.sttP99 < STT_THRESHOLDS.acceptable) {
      return "degraded";
    }
    return "poor";
  };

  const getTtsHealth = (): "good" | "degraded" | "poor" => {
    if (stats.ttsP99 < TTS_THRESHOLDS.good) {
      return "good";
    }
    if (stats.ttsP99 < TTS_THRESHOLDS.acceptable) {
      return "degraded";
    }
    return "poor";
  };

  const sttHealth = getSttHealth();
  const ttsHealth = getTtsHealth();

  const getOverall = (): "good" | "degraded" | "poor" => {
    if (sttHealth === "poor" || ttsHealth === "poor") {
      return "poor";
    }
    if (sttHealth === "degraded" || ttsHealth === "degraded") {
      return "degraded";
    }
    return "good";
  };

  return {
    sttHealth,
    ttsHealth,
    overall: getOverall(),
  };
}

export function renderLatencySummary(summary: LatencySummary): string {
  const healthColors = {
    good: colors.success,
    degraded: colors.warning,
    poor: colors.error,
  };

  const healthIcons = {
    good: "●",
    degraded: "◐",
    poor: "○",
  };

  const icon = fg(healthColors[summary.overall])(healthIcons[summary.overall]);
  const label =
    summary.overall === "good"
      ? "Healthy"
      : summary.overall === "degraded"
        ? "Degraded"
        : "Poor";

  return `${icon} ${dim("Voice latency:")} ${fg(healthColors[summary.overall])(label)}`;
}
