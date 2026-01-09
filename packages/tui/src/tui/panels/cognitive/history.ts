import type {
  CognitivePhase,
  CognitiveTransition,
} from "../../subscriptions/cognitive";
import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function renderTimeline(
  transitions: CognitiveTransition[],
  phase: CognitivePhase,
  width: number
): string[] {
  const recent = transitions.slice(-5);
  const lines: string[] = [];
  for (const t of recent) {
    const when = dim(formatTime(t.timestamp));
    const from = dim(t.from);
    const to = fg(colors.primary)(t.to);
    const reason = t.reason
      ? dim(` — ${truncate(t.reason, Math.max(10, width - 26))}`)
      : "";
    lines.push(`  ${when} ${from} → ${to}${reason}`);
  }

  if (recent.length === 0) {
    lines.push(dim(`  No transitions (phase=${phase})`));
  }

  return lines;
}

export function renderHistory(
  transitions: CognitiveTransition[],
  maxLines: number,
  width: number
): string[] {
  const slice = transitions.slice(-maxLines);
  return slice.map((t) => {
    const when = dim(formatTime(t.timestamp));
    const msg = `${t.from} → ${t.to}`;
    return `  ${when} ${truncate(msg, Math.max(10, width - 10))}`;
  });
}
