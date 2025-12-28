/**
 * ALFRED TUI Header Panel
 *
 * Top bar displaying ALFRED logo, time, and cognitive state indicator.
 */

import { colors } from "../theme";
import { bold, center, dim, fg, padRight } from "../typography";
import { BasePanel } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CognitivePhase =
  | "idle"
  | "capturing"
  | "thinking"
  | "deciding"
  | "executing"
  | "reflecting";

export type HeaderState = {
  phase: CognitivePhase;
  autonomy: number;
  time: string;
};

// ─── Phase Display ───────────────────────────────────────────────────────────

function getPhaseDisplay(phase: CognitivePhase): {
  icon: string;
  label: string;
  color: string;
} {
  switch (phase) {
    case "idle":
      return { icon: "○", label: "IDLE", color: colors.muted };
    case "capturing":
      return { icon: "◉", label: "CAPTURING", color: colors.primary };
    case "thinking":
      return { icon: "◎", label: "THINKING", color: colors.warning };
    case "deciding":
      return { icon: "◉", label: "DECIDING", color: colors.primary };
    case "executing":
      return { icon: "●", label: "EXECUTING", color: colors.success };
    case "reflecting":
      return { icon: "◐", label: "REFLECTING", color: colors.textMuted };
  }
}

function getAutonomyDisplay(level: number): { label: string; color: string } {
  if (level >= 0.7) {
    return { label: "HIGH", color: colors.success };
  }
  if (level >= 0.5) {
    return { label: "MED", color: colors.primary };
  }
  if (level >= 0.3) {
    return { label: "LOW", color: colors.warning };
  }
  return { label: "MIN", color: colors.error };
}

// ─── Header Panel ────────────────────────────────────────────────────────────

export class HeaderPanel extends BasePanel {
  readonly id = "header";
  readonly label = "ALFRED";

  private state: HeaderState = {
    phase: "idle",
    autonomy: 0.72,
    time: "",
  };

  private timeInterval: ReturnType<typeof setInterval> | null = null;

  init(): void {
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
  }

  destroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
    super.destroy();
  }

  private updateTime(): void {
    const now = new Date();
    this.state.time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  setState(updates: Partial<HeaderState>): void {
    this.state = { ...this.state, ...updates };
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    if (width < 20) {
      return [];
    }

    const { phase, autonomy, time } = this.state;
    const phaseDisplay = getPhaseDisplay(phase);
    const autonomyDisplay = getAutonomyDisplay(autonomy);

    // Left: Logo
    const logo = bold(fg(colors.primary)("ALFRED"));

    // Center: Phase indicator
    const phaseIcon = fg(phaseDisplay.color)(phaseDisplay.icon);
    const phaseLabel = fg(phaseDisplay.color)(phaseDisplay.label);
    const phaseText = `${phaseIcon} ${phaseLabel}`;

    // Right: Autonomy and time
    const autonomyText = `A:${fg(autonomyDisplay.color)(autonomyDisplay.label)}`;
    const timeText = dim(time);
    const rightText = `${autonomyText} ${timeText}`;

    // Calculate spacing
    const logoLen = 6; // "ALFRED"
    const phaseLen = phaseDisplay.label.length + 2;
    const rightLen = 6 + time.length; // "A:XXX HH:MM"

    const leftPad = Math.floor((width - phaseLen) / 2) - logoLen;
    const rightPad = width - logoLen - leftPad - phaseLen - rightLen;

    const line = `${logo}${" ".repeat(Math.max(1, leftPad))}${phaseText}${" ".repeat(Math.max(1, rightPad))}${rightText}`;

    return [line];
  }

  // Override render to skip border for header
  render(): string[] {
    const { width } = this._bounds;
    if (width < 10) {
      return [];
    }

    const content = this.renderContent();
    const lines: string[] = [];

    // Content line
    for (const line of content) {
      lines.push(padRight(line, width));
    }

    // Bottom separator
    lines.push(dim("─".repeat(width)));

    return lines;
  }
}

// ─── Compact Header (for narrow terminals) ───────────────────────────────────

export class CompactHeaderPanel extends BasePanel {
  readonly id = "header";
  readonly label = "Header";

  private state: HeaderState = {
    phase: "idle",
    autonomy: 0.72,
    time: "",
  };

  private timeInterval: ReturnType<typeof setInterval> | null = null;

  init(): void {
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
  }

  destroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
    super.destroy();
  }

  private updateTime(): void {
    const now = new Date();
    this.state.time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  setState(updates: Partial<HeaderState>): void {
    this.state = { ...this.state, ...updates };
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const { phase, time } = this.state;
    const phaseDisplay = getPhaseDisplay(phase);

    const logo = bold(fg(colors.primary)("A"));
    const phaseIcon = fg(phaseDisplay.color)(phaseDisplay.icon);
    const timeText = dim(time);

    const line = `${logo} ${phaseIcon} ${timeText}`;
    return [center(line, width)];
  }

  render(): string[] {
    const content = this.renderContent();
    const lines: string[] = [];

    for (const line of content) {
      lines.push(padRight(line, this._bounds.width));
    }

    lines.push(dim("─".repeat(this._bounds.width)));

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createHeaderPanel(
  compact = false
): HeaderPanel | CompactHeaderPanel {
  return compact ? new CompactHeaderPanel() : new HeaderPanel();
}
