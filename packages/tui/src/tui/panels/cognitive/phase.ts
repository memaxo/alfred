import type { CognitivePhase } from "../../subscriptions/cognitive";
import { colors } from "../../theme";
import { bold, dim, fg, progressBar } from "../../typography";

const PHASES: Record<CognitivePhase, { icon: string; color: string }> = {
  idle: { icon: "○", color: colors.muted },
  capturing: { icon: "◉", color: colors.primary },
  thinking: { icon: "◎", color: colors.warning },
  deciding: { icon: "◑", color: colors.primary },
  executing: { icon: "●", color: colors.success },
  reflecting: { icon: "◐", color: colors.textMuted },
};

export function renderPhaseIndicator(
  phase: CognitivePhase,
  width: number
): string {
  const p = PHASES[phase];
  const label = phase.toUpperCase();
  const barWidth = Math.max(6, Math.min(20, width - 22));
  const progress =
    phase === "idle"
      ? 0.1
      : phase === "capturing"
        ? 0.3
        : phase === "thinking"
          ? 0.5
          : phase === "deciding"
            ? 0.7
            : phase === "executing"
              ? 0.9
              : 1;
  const bar = progressBar(progress, barWidth, { color: p.color });
  return `${bold("Phase:")} ${fg(p.color)(p.icon)} ${bold(label)} ${dim(bar)}`;
}
