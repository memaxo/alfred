/**
 * ALFRED TUI Cognitive History
 *
 * Displays recent cognitive state transitions in a timeline.
 */

import type {
  CognitivePhase,
  CognitiveTransition,
} from "../../subscriptions/cognitive";
// No colors needed - using phase colors
import { dim, fg, truncate } from "../../typography";
import { getPhaseColor, getPhaseIcon } from "./phase";

// ─── Time Formatting ─────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) {
    return "just now";
  }
  if (diff < 60_000) {
    return `${Math.floor(diff / 1000)}s ago`;
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }
  return formatTime(timestamp);
}

// ─── Transition Rendering ────────────────────────────────────────────────────

export function renderTransition(
  transition: CognitiveTransition,
  width: number
): string {
  const { from, to, timestamp, reason } = transition;

  const time = dim(formatTime(timestamp));
  const fromIcon = fg(getPhaseColor(from))(getPhaseIcon(from));
  const toIcon = fg(getPhaseColor(to))(getPhaseIcon(to));
  const arrow = dim("→");

  // Base: "HH:MM:SS  ○ → ●  reason"
  const base = `${time}  ${fromIcon} ${arrow} ${toIcon}`;

  if (reason && width > 30) {
    const availableWidth = width - 20;
    const truncatedReason = truncate(reason, availableWidth);
    return `${base}  ${dim(truncatedReason)}`;
  }

  return base;
}

export function renderTransitionCompact(
  transition: CognitiveTransition
): string {
  const { from, to, timestamp } = transition;

  const time = dim(formatRelativeTime(timestamp));
  const fromIcon = fg(getPhaseColor(from))(from.slice(0, 3));
  const toIcon = fg(getPhaseColor(to))(to.slice(0, 3));
  const arrow = dim("→");

  return `${fromIcon} ${arrow} ${toIcon} ${time}`;
}

// ─── History List ────────────────────────────────────────────────────────────

export function renderHistory(
  transitions: CognitiveTransition[],
  maxItems: number,
  width: number
): string[] {
  const lines: string[] = [];

  // Header
  lines.push(dim("Recent transitions:"));

  if (transitions.length === 0) {
    lines.push(dim("  No transitions yet"));
    return lines;
  }

  // Show most recent first
  const recent = [...transitions].reverse().slice(0, maxItems);

  for (const transition of recent) {
    lines.push(`  ${renderTransition(transition, width - 2)}`);
  }

  // Show count if more exist
  if (transitions.length > maxItems) {
    const remaining = transitions.length - maxItems;
    lines.push(dim(`  ... and ${remaining} more`));
  }

  return lines;
}

// ─── Timeline Visualization ──────────────────────────────────────────────────

export function renderTimeline(
  transitions: CognitiveTransition[],
  currentPhase: CognitivePhase,
  width: number
): string[] {
  const lines: string[] = [];

  if (transitions.length === 0) {
    // Just show current phase
    const icon = fg(getPhaseColor(currentPhase))(getPhaseIcon(currentPhase));
    lines.push(`${icon} ${dim(currentPhase)}`);
    return lines;
  }

  // Build timeline from transitions
  const timelineWidth = Math.min(width - 10, 40);
  const recentTransitions = transitions.slice(-timelineWidth);

  const timeline: string[] = [];
  for (const t of recentTransitions) {
    timeline.push(fg(getPhaseColor(t.to))(getPhaseIcon(t.to)));
  }

  // Add current phase at end
  timeline.push(fg(getPhaseColor(currentPhase))(getPhaseIcon(currentPhase)));

  // Connect with lines
  const connected = timeline.join(dim("─"));
  lines.push(connected);

  // Time labels
  if (recentTransitions.length > 0 && recentTransitions[0]?.timestamp) {
    const firstTime = formatRelativeTime(recentTransitions[0].timestamp);
    const lastTime = "now";
    const padding = " ".repeat(
      Math.max(0, connected.length - firstTime.length - lastTime.length - 2)
    );
    lines.push(dim(`${firstTime}${padding}${lastTime}`));
  }

  return lines;
}

// ─── Phase Duration ──────────────────────────────────────────────────────────

export function calculatePhaseDurations(
  transitions: CognitiveTransition[]
): Map<CognitivePhase, number> {
  const durations = new Map<CognitivePhase, number>();

  for (let i = 0; i < transitions.length - 1; i++) {
    const current = transitions[i];
    const next = transitions[i + 1];
    if (current && next) {
      const duration = next.timestamp - current.timestamp;

      const existing = durations.get(current.to) ?? 0;
      durations.set(current.to, existing + duration);
    }
  }

  return durations;
}

export function renderPhaseDurations(
  transitions: CognitiveTransition[],
  width: number
): string[] {
  const durations = calculatePhaseDurations(transitions);
  const lines: string[] = [];

  lines.push(dim("Phase time distribution:"));

  if (durations.size === 0) {
    lines.push(dim("  No data yet"));
    return lines;
  }

  // Calculate total
  let total = 0;
  for (const d of durations.values()) {
    total += d;
  }

  // Render bars
  const barWidth = Math.min(width - 20, 20);

  for (const [phase, duration] of durations) {
    const ratio = total > 0 ? duration / total : 0;
    const filled = Math.round(ratio * barWidth);
    const color = getPhaseColor(phase);
    const bar =
      fg(color)("█".repeat(filled)) + dim("░".repeat(barWidth - filled));
    const percent = (ratio * 100).toFixed(0).padStart(3);
    const label = phase.slice(0, 4).padEnd(4);

    lines.push(`  ${dim(label)} ${bar} ${dim(`${percent}%`)}`);
  }

  return lines;
}
