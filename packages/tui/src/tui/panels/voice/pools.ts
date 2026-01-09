import type { VoicePoolStats } from "../../subscriptions/voice";
import { colors } from "../../theme";
import { dim, fg, progressBar } from "../../typography";

function poolLine(pool: VoicePoolStats, width: number, color: string): string {
  const barWidth = Math.max(6, Math.min(18, width - 28));
  const frac = pool.maxWorkers > 0 ? pool.workers / pool.maxWorkers : 0;
  const bar = progressBar(frac, barWidth, { color });
  return `  ${fg(color)(pool.name)} ${dim(`${pool.workers}/${pool.maxWorkers}`)} ${bar} ${dim(`q=${pool.queueDepth} p=${pool.processing}`)}`;
}

export function renderDualPools(
  stt: VoicePoolStats,
  tts: VoicePoolStats,
  width: number
): string[] {
  return [
    poolLine(stt, width, colors.primary),
    poolLine(tts, width, colors.success),
  ];
}

export function renderPoolStatus(
  pool: VoicePoolStats,
  width: number
): string[] {
  const color = pool.name.toLowerCase().includes("tts")
    ? colors.success
    : colors.primary;
  return [poolLine(pool, width, color)];
}
