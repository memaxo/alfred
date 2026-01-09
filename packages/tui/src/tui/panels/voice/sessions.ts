import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

export function renderSessionCount(active: number): string {
  if (active === 1) {
    return "1 active session";
  }
  return `${active} active sessions`;
}

export type VoiceSession = {
  id: string;
  status: "active" | "paused" | "ended";
  duration: number;
};

export function renderSessions(
  sessions: VoiceSession[],
  width: number
): string[] {
  if (sessions.length === 0) {
    return [dim("  No sessions")];
  }

  const icon = (status: VoiceSession["status"]) =>
    status === "active"
      ? fg(colors.success)("●")
      : status === "paused"
        ? fg(colors.warning)("⏸")
        : dim("○");

  return sessions.map((s) => {
    const mins = Math.floor(s.duration / 60);
    const secs = s.duration % 60;
    const dur = dim(`${mins}:${String(secs).padStart(2, "0")}`);
    return `  ${icon(s.status)} ${truncate(s.id, Math.max(10, width - 14))} ${dur}`;
  });
}
