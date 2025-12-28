/**
 * ALFRED TUI Cognitive Phase Visualization
 *
 * Displays the current cognitive phase with progress indicator.
 */

import type { CognitivePhase } from "../../subscriptions/cognitive";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";

// ─── Phase Configuration ─────────────────────────────────────────────────────

type PhaseConfig = {
  label: string;
  icon: string;
  color: string;
  description: string;
};

const PHASE_CONFIGS: Record<CognitivePhase, PhaseConfig> = {
  idle: {
    label: "IDLE",
    icon: "○",
    color: colors.muted,
    description: "Awaiting input",
  },
  capturing: {
    label: "CAPTURING",
    icon: "◉",
    color: colors.primary,
    description: "Processing input",
  },
  thinking: {
    label: "THINKING",
    icon: "◎",
    color: colors.warning,
    description: "Analyzing context",
  },
  deciding: {
    label: "DECIDING",
    icon: "◉",
    color: colors.primary,
    description: "Evaluating options",
  },
  executing: {
    label: "EXECUTING",
    icon: "●",
    color: colors.success,
    description: "Performing action",
  },
  reflecting: {
    label: "REFLECTING",
    icon: "◐",
    color: colors.textMuted,
    description: "Learning from outcome",
  },
};

// ─── Phase Rendering ─────────────────────────────────────────────────────────

export function renderPhaseIndicator(
  phase: CognitivePhase,
  width: number
): string {
  const config = PHASE_CONFIGS[phase];
  const color = fg(config.color);

  const icon = color(config.icon);
  const label = bold(color(config.label));
  const desc = dim(config.description);

  // Calculate padding
  const contentLen =
    config.icon.length +
    1 +
    config.label.length +
    2 +
    config.description.length;
  const padding = Math.max(0, width - contentLen);

  return `${icon} ${label}  ${desc}${" ".repeat(padding)}`;
}

export function renderPhaseWithProgress(
  phase: CognitivePhase,
  progress: number,
  width: number
): string[] {
  const config = PHASE_CONFIGS[phase];
  const color = fg(config.color);

  const lines: string[] = [];

  // Phase label line
  const icon = color(config.icon);
  const label = bold(color(config.label));
  lines.push(`${icon} ${label}`);

  // Progress bar
  if (progress > 0 && progress < 1) {
    const barWidth = Math.min(width - 2, 20);
    const filled = Math.round(progress * barWidth);
    const empty = barWidth - filled;
    const filledBar = color(progressChars.filled.repeat(filled));
    const emptyBar = dim(progressChars.empty.repeat(empty));
    const percent = Math.round(progress * 100);
    lines.push(`  ${filledBar}${emptyBar} ${dim(`${percent}%`)}`);
  }

  return lines;
}

// ─── Phase Timeline ──────────────────────────────────────────────────────────

const PHASE_ORDER: CognitivePhase[] = [
  "idle",
  "capturing",
  "thinking",
  "deciding",
  "executing",
  "reflecting",
];

export function renderPhaseTimeline(
  currentPhase: CognitivePhase,
  _width: number
): string {
  const segments: string[] = [];

  for (const phase of PHASE_ORDER) {
    const config = PHASE_CONFIGS[phase];
    const isCurrent = phase === currentPhase;
    const isPast =
      PHASE_ORDER.indexOf(phase) < PHASE_ORDER.indexOf(currentPhase);

    if (isCurrent) {
      segments.push(bold(fg(config.color)(config.icon)));
    } else if (isPast) {
      segments.push(fg(colors.success)("●"));
    } else {
      segments.push(dim("○"));
    }
  }

  const timeline = segments.join(dim("─"));
  return timeline;
}

// ─── Phase State Indicator ───────────────────────────────────────────────────

export function renderCompactPhase(phase: CognitivePhase): string {
  const config = PHASE_CONFIGS[phase];
  return fg(config.color)(`${config.icon} ${config.label}`);
}

export function getPhaseColor(phase: CognitivePhase): string {
  return PHASE_CONFIGS[phase].color;
}

export function getPhaseIcon(phase: CognitivePhase): string {
  return PHASE_CONFIGS[phase].icon;
}
