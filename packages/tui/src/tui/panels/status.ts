/**
 * ALFRED TUI Status Panel
 *
 * Compact status bar showing key metrics at a glance.
 */

import { colors, progressChars } from "../theme";
import { dim, fg, padRight } from "../typography";
import { BasePanel } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatusState = {
  autonomy: number;
  energy: number;
  frustration: number;
  activeWorkflows: number;
  pendingWorkflows: number;
  voiceStatus: "standby" | "listening" | "speaking" | "processing" | "offline";
  dbStatus: "connected" | "degraded" | "disconnected";
};

// ─── Status Indicators ───────────────────────────────────────────────────────

function voiceStatusDisplay(status: StatusState["voiceStatus"]): {
  icon: string;
  color: string;
} {
  switch (status) {
    case "standby":
      return { icon: "◯", color: colors.muted };
    case "listening":
      return { icon: "◉", color: colors.primary };
    case "speaking":
      return { icon: "◉", color: colors.success };
    case "processing":
      return { icon: "◎", color: colors.warning };
    case "offline":
      return { icon: "○", color: colors.error };
  }
}

function dbStatusDisplay(status: StatusState["dbStatus"]): {
  icon: string;
  color: string;
} {
  switch (status) {
    case "connected":
      return { icon: "●", color: colors.success };
    case "degraded":
      return { icon: "◐", color: colors.warning };
    case "disconnected":
      return { icon: "○", color: colors.error };
  }
}

// ─── Mini Progress Bar ───────────────────────────────────────────────────────

function miniProgressBar(value: number, width: number, color: string): string {
  const filled = Math.round(value * width);
  const empty = width - filled;
  return (
    fg(color)(progressChars.filled.repeat(filled)) +
    dim(progressChars.empty.repeat(empty))
  );
}

// ─── Status Panel ────────────────────────────────────────────────────────────

export class StatusPanel extends BasePanel {
  readonly id = "status";
  readonly label = "Status";

  private state: StatusState = {
    autonomy: 0.72,
    energy: 0.85,
    frustration: 0.12,
    activeWorkflows: 0,
    pendingWorkflows: 0,
    voiceStatus: "standby",
    dbStatus: "connected",
  };

  setState(updates: Partial<StatusState>): void {
    this.state = { ...this.state, ...updates };
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    if (width < 30) {
      return this.renderCompact();
    }

    const {
      autonomy,
      energy,
      frustration,
      activeWorkflows,
      pendingWorkflows,
      voiceStatus,
      dbStatus,
    } = this.state;

    const lines: string[] = [];

    // Row 1: Autonomy gauge
    const autonomyColor =
      autonomy >= 0.7
        ? colors.success
        : autonomy >= 0.4
          ? colors.warning
          : colors.error;
    const autonomyBar = miniProgressBar(autonomy, 10, autonomyColor);
    const autonomyPercent = Math.round(autonomy * 100)
      .toString()
      .padStart(3);
    lines.push(
      `${dim("Autonomy")} ${autonomyBar} ${fg(autonomyColor)(autonomyPercent)}%`
    );

    // Row 2: Energy and Frustration
    const energyBar = miniProgressBar(energy, 6, colors.success);
    const frustrationBar = miniProgressBar(
      frustration,
      6,
      frustration > 0.5 ? colors.error : colors.muted
    );
    lines.push(
      `${dim("Energy")} ${energyBar}  ${dim("Frustration")} ${frustrationBar}`
    );

    // Row 3: Workflows and status indicators
    const voice = voiceStatusDisplay(voiceStatus);
    const db = dbStatusDisplay(dbStatus);

    const workflowText =
      activeWorkflows > 0
        ? fg(colors.primary)(`${activeWorkflows} active`)
        : dim("no active");
    const pendingText =
      pendingWorkflows > 0 ? `, ${pendingWorkflows} pending` : "";

    lines.push(
      `${dim("Workflows:")} ${workflowText}${dim(pendingText)}  ${fg(voice.color)(voice.icon)} ${fg(db.color)(db.icon)}`
    );

    return lines;
  }

  private renderCompact(): string[] {
    const { autonomy, voiceStatus, dbStatus, activeWorkflows } = this.state;

    const autonomyColor =
      autonomy >= 0.7
        ? colors.success
        : autonomy >= 0.4
          ? colors.warning
          : colors.error;
    const voice = voiceStatusDisplay(voiceStatus);
    const db = dbStatusDisplay(dbStatus);

    const autonomyText = `A:${Math.round(autonomy * 100)}%`;
    const workflowText = activeWorkflows > 0 ? `W:${activeWorkflows}` : "";

    return [
      `${fg(autonomyColor)(autonomyText)} ${workflowText} ${fg(voice.color)(voice.icon)}${fg(db.color)(db.icon)}`,
    ];
  }

  render(): string[] {
    const { width, height } = this._bounds;
    if (width < 10 || height < 2) {
      return [];
    }

    const content = this.renderContent();
    const lines: string[] = [];

    // Top separator
    lines.push(dim("─".repeat(width)));

    // Content
    for (let i = 0; i < Math.min(content.length, height - 2); i++) {
      const line = content[i] ?? "";
      lines.push(padRight(` ${line}`, width));
    }

    // Pad remaining height
    while (lines.length < height - 1) {
      lines.push(" ".repeat(width));
    }

    // Bottom separator
    lines.push(dim("─".repeat(width)));

    return lines;
  }
}

// ─── Inline Status (for header integration) ──────────────────────────────────

export class InlineStatusPanel extends BasePanel {
  readonly id = "inline-status";
  readonly label = "Status";

  private state: StatusState = {
    autonomy: 0.72,
    energy: 0.85,
    frustration: 0.12,
    activeWorkflows: 0,
    pendingWorkflows: 0,
    voiceStatus: "standby",
    dbStatus: "connected",
  };

  setState(updates: Partial<StatusState>): void {
    this.state = { ...this.state, ...updates };
  }

  renderContent(): string[] {
    const { autonomy, energy, activeWorkflows, voiceStatus, dbStatus } =
      this.state;

    const autonomyColor =
      autonomy >= 0.7
        ? colors.success
        : autonomy >= 0.4
          ? colors.warning
          : colors.error;
    const voice = voiceStatusDisplay(voiceStatus);
    const db = dbStatusDisplay(dbStatus);

    const parts: string[] = [];

    // Autonomy
    parts.push(
      `${dim("A:")}${fg(autonomyColor)(Math.round(autonomy * 100).toString())}${dim("%")}`
    );

    // Energy
    parts.push(
      `${dim("E:")}${fg(colors.success)(Math.round(energy * 100).toString())}${dim("%")}`
    );

    // Workflows
    if (activeWorkflows > 0) {
      parts.push(
        `${dim("W:")}${fg(colors.primary)(activeWorkflows.toString())}`
      );
    }

    // Status icons
    parts.push(`${fg(voice.color)(voice.icon)}${fg(db.color)(db.icon)}`);

    return [parts.join(" ")];
  }

  render(): string[] {
    return this.renderContent();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createStatusPanel(
  inline = false
): StatusPanel | InlineStatusPanel {
  return inline ? new InlineStatusPanel() : new StatusPanel();
}
