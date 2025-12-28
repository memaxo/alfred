/**
 * ALFRED TUI Voice Pool Status
 *
 * Displays STT and TTS worker pool status.
 */

import type { VoicePoolStats } from "../../subscriptions/voice";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";

// ─── Pool Status Colors ──────────────────────────────────────────────────────

function getPoolHealthColor(stats: VoicePoolStats): string {
  const utilization = stats.workers / stats.maxWorkers;
  const queuePressure = stats.queueDepth > 5;

  if (stats.workers === 0) {
    return colors.error;
  }
  if (queuePressure && utilization > 0.8) {
    return colors.error;
  }
  if (queuePressure || utilization > 0.9) {
    return colors.warning;
  }
  return colors.success;
}

function getPoolStatusLabel(stats: VoicePoolStats): string {
  if (stats.workers === 0) {
    return "offline";
  }
  if (stats.queueDepth > 10) {
    return "overloaded";
  }
  if (stats.queueDepth > 5) {
    return "busy";
  }
  if (stats.processing > 0) {
    return "active";
  }
  return "idle";
}

// ─── Pool Rendering ──────────────────────────────────────────────────────────

export function renderPoolStatus(
  pool: VoicePoolStats,
  width: number
): string[] {
  const lines: string[] = [];
  const healthColor = getPoolHealthColor(pool);
  const statusLabel = getPoolStatusLabel(pool);

  // Pool name and status
  const nameUpper = pool.name.toUpperCase();
  lines.push(`${bold(nameUpper)} ${fg(healthColor)(statusLabel)}`);

  // Workers bar
  const barWidth = Math.min(width - 20, 15);
  const filled = Math.round((pool.workers / pool.maxWorkers) * barWidth);
  const empty = barWidth - filled;
  const workerBar =
    fg(healthColor)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty));

  lines.push(
    `  ${dim("Workers")} ${workerBar} ${pool.workers}/${pool.maxWorkers}`
  );

  // Queue depth
  const queueColor =
    pool.queueDepth > 10
      ? colors.error
      : pool.queueDepth > 5
        ? colors.warning
        : colors.success;
  lines.push(
    `  ${dim("Queue:")} ${fg(queueColor)(pool.queueDepth.toString())} ${dim("processing:")} ${pool.processing}`
  );

  return lines;
}

export function renderPoolCompact(pool: VoicePoolStats): string {
  const healthColor = getPoolHealthColor(pool);
  const icon = pool.workers > 0 ? "●" : "○";
  return `${fg(healthColor)(icon)} ${pool.name.toUpperCase()} ${pool.workers}/${pool.maxWorkers}`;
}

// ─── Dual Pool Display ───────────────────────────────────────────────────────

export function renderDualPools(
  sttPool: VoicePoolStats,
  ttsPool: VoicePoolStats,
  width: number
): string[] {
  const lines: string[] = [];

  // STT Pool
  const sttLines = renderPoolStatus(sttPool, width);
  for (const line of sttLines) {
    lines.push(line);
  }

  lines.push("");

  // TTS Pool
  const ttsLines = renderPoolStatus(ttsPool, width);
  for (const line of ttsLines) {
    lines.push(line);
  }

  return lines;
}

export function renderPoolsSummary(
  sttPool: VoicePoolStats,
  ttsPool: VoicePoolStats
): string {
  const sttCompact = renderPoolCompact(sttPool);
  const ttsCompact = renderPoolCompact(ttsPool);
  return `${sttCompact}  ${ttsCompact}`;
}

// ─── Pool Utilization ────────────────────────────────────────────────────────

export type PoolUtilization = {
  workerUtilization: number; // 0-1
  queuePressure: number; // 0-1 based on queue depth
  overall: number; // Combined metric
};

export function calculatePoolUtilization(
  stats: VoicePoolStats
): PoolUtilization {
  const workerUtilization =
    stats.workers > 0 ? stats.processing / stats.workers : 0;

  const queuePressure = Math.min(stats.queueDepth / 10, 1);

  const overall = workerUtilization * 0.7 + queuePressure * 0.3;

  return { workerUtilization, queuePressure, overall };
}

export function renderPoolUtilizationBar(
  utilization: PoolUtilization,
  width: number
): string {
  const color =
    utilization.overall > 0.9
      ? colors.error
      : utilization.overall > 0.7
        ? colors.warning
        : colors.success;

  const filled = Math.round(utilization.overall * width);
  const empty = width - filled;

  return (
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty))
  );
}

// ─── Pool Health Indicator ───────────────────────────────────────────────────

export type PoolHealth = "healthy" | "degraded" | "overloaded" | "offline";

export function getPoolHealth(stats: VoicePoolStats): PoolHealth {
  if (stats.workers === 0) {
    return "offline";
  }

  const utilization = calculatePoolUtilization(stats);
  if (utilization.overall > 0.9) {
    return "overloaded";
  }
  if (utilization.overall > 0.7 || stats.queueDepth > 5) {
    return "degraded";
  }
  return "healthy";
}

export function renderPoolHealthIcon(health: PoolHealth): string {
  switch (health) {
    case "healthy":
      return fg(colors.success)("●");
    case "degraded":
      return fg(colors.warning)("◐");
    case "overloaded":
      return fg(colors.error)("●");
    case "offline":
      return fg(colors.error)("○");
  }
}
