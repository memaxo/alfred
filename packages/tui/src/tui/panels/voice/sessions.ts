/**
 * ALFRED TUI Voice Sessions
 *
 * Displays active voice sessions.
 */

import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceSession = {
  id: string;
  status: "connecting" | "active" | "processing" | "closing";
  duration: number; // ms since start
  direction: "input" | "output" | "both";
};

// ─── Session Status ──────────────────────────────────────────────────────────

function getSessionStatusIcon(status: VoiceSession["status"]): string {
  switch (status) {
    case "connecting":
      return fg(colors.warning)("◎");
    case "active":
      return fg(colors.success)("●");
    case "processing":
      return fg(colors.primary)("◉");
    case "closing":
      return fg(colors.muted)("○");
  }
}

export function getSessionStatusLabel(status: VoiceSession["status"]): string {
  switch (status) {
    case "connecting":
      return "connecting";
    case "active":
      return "active";
    case "processing":
      return "processing";
    case "closing":
      return "closing";
  }
}

// ─── Time Formatting ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// ─── Session Rendering ───────────────────────────────────────────────────────

export function renderSession(session: VoiceSession, _width: number): string {
  const icon = getSessionStatusIcon(session.status);
  const duration = formatDuration(session.duration);
  const direction =
    session.direction === "both"
      ? "↔"
      : session.direction === "input"
        ? "←"
        : "→";

  const id = truncate(session.id, 10);

  return `${icon} ${id} ${dim(direction)} ${dim(duration)}`;
}

export function renderSessions(
  sessions: VoiceSession[],
  width: number,
  maxSessions = 5
): string[] {
  const lines: string[] = [];

  if (sessions.length === 0) {
    lines.push(dim("  No active sessions"));
    return lines;
  }

  const visible = sessions.slice(0, maxSessions);

  for (const session of visible) {
    lines.push(`  ${renderSession(session, width - 2)}`);
  }

  if (sessions.length > maxSessions) {
    lines.push(dim(`  ... and ${sessions.length - maxSessions} more`));
  }

  return lines;
}

// ─── Session Count Display ───────────────────────────────────────────────────

export function renderSessionCount(count: number): string {
  if (count === 0) {
    return dim("No active sessions");
  }

  const color = count > 5 ? colors.warning : colors.success;
  return `${fg(color)(count.toString())} active session${count !== 1 ? "s" : ""}`;
}

export function renderSessionCountCompact(count: number): string {
  const icon = count > 0 ? fg(colors.success)("●") : fg(colors.muted)("○");
  return `${icon} ${count} session${count !== 1 ? "s" : ""}`;
}

// ─── Session Summary ─────────────────────────────────────────────────────────

export type SessionSummary = {
  total: number;
  active: number;
  processing: number;
  avgDuration: number;
};

export function calculateSessionSummary(
  sessions: VoiceSession[]
): SessionSummary {
  const active = sessions.filter((s) => s.status === "active").length;
  const processing = sessions.filter((s) => s.status === "processing").length;
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;

  return {
    total: sessions.length,
    active,
    processing,
    avgDuration,
  };
}

export function renderSessionSummary(summary: SessionSummary): string {
  const parts: string[] = [];

  if (summary.active > 0) {
    parts.push(`${fg(colors.success)(summary.active.toString())} active`);
  }
  if (summary.processing > 0) {
    parts.push(
      `${fg(colors.primary)(summary.processing.toString())} processing`
    );
  }
  if (summary.avgDuration > 0) {
    parts.push(`avg ${formatDuration(summary.avgDuration)}`);
  }

  return parts.length > 0 ? parts.join(dim(" • ")) : dim("No sessions");
}

// ─── Mock Sessions (for testing) ─────────────────────────────────────────────

export function createMockSession(): VoiceSession {
  const statuses: VoiceSession["status"][] = [
    "connecting",
    "active",
    "processing",
    "closing",
  ];
  const directions: VoiceSession["direction"][] = ["input", "output", "both"];

  const status =
    statuses[Math.floor(Math.random() * statuses.length)] ?? "active";
  const direction =
    directions[Math.floor(Math.random() * directions.length)] ?? "both";

  return {
    id: `sess-${Math.random().toString(36).slice(2, 8)}`,
    status,
    duration: Math.floor(Math.random() * 60_000),
    direction,
  };
}
