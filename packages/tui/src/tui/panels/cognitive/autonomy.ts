import type { AutonomyState } from "../../subscriptions/cognitive";
import { colors } from "../../theme";
import { bold, dim, fg, progressBar } from "../../typography";

export function renderAutonomyGauge(
  autonomy: AutonomyState,
  width: number
): string[] {
  const barWidth = Math.max(8, Math.min(26, width - 22));
  const level = Math.max(0, Math.min(1, autonomy.level));
  const confidence = Math.max(0, Math.min(1, autonomy.confidence));

  const levelBar = progressBar(level, barWidth, { color: colors.primary });
  const confBar = progressBar(confidence, barWidth, { color: colors.success });

  return [
    `${bold(dim("Autonomy"))}`,
    `  ${dim("Level:")}      ${levelBar} ${fg(colors.primary)(`${Math.round(level * 100)}%`)}`,
    `  ${dim("Confidence:")} ${confBar} ${fg(colors.success)(`${Math.round(confidence * 100)}%`)}`,
  ];
}

export function renderThresholdComparison(
  level: number,
  threshold: number
): string {
  const l = Math.max(0, Math.min(1, level));
  const t = Math.max(0, Math.min(1, threshold));
  const ok = l >= t;
  return ok
    ? fg(colors.success)(
        `  ✓ above threshold (${Math.round(l * 100)}% ≥ ${Math.round(t * 100)}%)`
      )
    : fg(colors.warning)(
        `  ⚠ below threshold (${Math.round(l * 100)}% < ${Math.round(t * 100)}%)`
      );
}
