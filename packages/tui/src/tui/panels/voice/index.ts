/**
 * ALFRED TUI Voice Panel
 *
 * Voice pipeline status and monitoring panel.
 */

import type { KeyEvent } from "../../input/keys";
import type {
  VoicePipelineStatus,
  VoiceState,
} from "../../subscriptions/voice";
import { createVoiceStore, type VoiceStore } from "../../subscriptions/voice";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";
import {
  calculateLatencySummary,
  renderLatencySummary,
  renderVoiceLatency,
} from "./latency";
import { renderDualPools } from "./pools";
import {
  createMockSession,
  renderSessionCount,
  renderSessions,
  type VoiceSession,
} from "./sessions";

// ─── Pipeline Status Display ─────────────────────────────────────────────────

function getPipelineStatusDisplay(status: VoicePipelineStatus): {
  icon: string;
  label: string;
  color: string;
} {
  switch (status) {
    case "offline":
      return { icon: "○", label: "Offline", color: colors.error };
    case "initializing":
      return { icon: "◎", label: "Initializing", color: colors.warning };
    case "standby":
      return { icon: "●", label: "Standby", color: colors.muted };
    case "listening":
      return { icon: "◉", label: "Listening", color: colors.primary };
    case "processing":
      return { icon: "◉", label: "Processing", color: colors.warning };
    case "speaking":
      return { icon: "●", label: "Speaking", color: colors.success };
  }
}

// ─── Voice Panel ─────────────────────────────────────────────────────────────

export class VoicePanel extends BasePanel {
  readonly id = "voice";
  readonly label = "Voice";

  private readonly store: VoiceStore;
  private state: VoiceState | null = null;
  private mockSessions: VoiceSession[] = [];

  constructor(store?: VoiceStore) {
    super();
    this.store = store ?? createVoiceStore();
  }

  init(): void {
    const unsub = this.store.subscribe((state) => {
      this.state = state;
      // Generate mock sessions based on activeSessions count
      this.mockSessions = Array.from({ length: state.activeSessions }, () =>
        createMockSession()
      );
    });
    this.addSubscription(unsub);
  }

  handleKey(_event: KeyEvent): boolean {
    // Voice panel has no special key handling
    return false;
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;

    if (!this.state) {
      return [dim("  Loading voice status...")];
    }

    const lines: string[] = [];
    const { status, sttPool, ttsPool, latency, activeSessions } = this.state;

    // Pipeline status
    const statusDisplay = getPipelineStatusDisplay(status);
    const statusLine = `${fg(statusDisplay.color)(statusDisplay.icon)} ${bold(statusDisplay.label)}`;
    lines.push(statusLine);
    lines.push("");

    // Pools
    lines.push(bold(dim("Worker Pools")));
    const poolLines = renderDualPools(sttPool, ttsPool, width);
    for (const line of poolLines) {
      lines.push(line);
    }
    lines.push("");

    // Latency (compact view)
    lines.push(bold(dim("Latency")));
    const latencyLines = renderVoiceLatency(latency, width);
    for (const line of latencyLines) {
      lines.push(line);
    }

    // Summary
    const summary = calculateLatencySummary(latency);
    lines.push(renderLatencySummary(summary));
    lines.push("");

    // Sessions (if space permits)
    const remainingHeight = height - lines.length;
    if (remainingHeight > 3 && activeSessions > 0) {
      lines.push(bold(dim("Sessions")));
      lines.push(`  ${renderSessionCount(activeSessions)}`);

      if (remainingHeight > 5 && this.mockSessions.length > 0) {
        const sessionLines = renderSessions(
          this.mockSessions,
          width,
          remainingHeight - 4
        );
        for (const line of sessionLines) {
          lines.push(line);
        }
      }
    }

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createVoicePanel(store?: VoiceStore): VoicePanel {
  return new VoicePanel(store);
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from "./latency";
export * from "./pools";
export * from "./sessions";
