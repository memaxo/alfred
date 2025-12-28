/**
 * ALFRED TUI Status Bar Component
 *
 * Displays mode status, hints, and connection state.
 */

import { colors, icons } from "../theme";
import { bold, center, dim, fg, inverse, visibleLength } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export type KeyHint = {
  key: string;
  description: string;
};

export type StatusBarState = {
  mode: string;
  connectionStatus: ConnectionStatus;
  customMessage?: string;
  keyHints: KeyHint[];
};

// ─── State Factory ───────────────────────────────────────────────────────────

export function createStatusBarState(mode: string): StatusBarState {
  return {
    mode,
    connectionStatus: "disconnected",
    customMessage: undefined,
    keyHints: [],
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function connectionIcon(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return fg(colors.success)(icons.active);
    case "disconnected":
      return fg(colors.error)(icons.pending);
    case "connecting":
      return fg(colors.warning)(icons.pending);
  }
}

function connectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "connecting":
      return "Connecting...";
  }
}

export function renderKeyHints(hints: KeyHint[]): string {
  return hints
    .map((h) => `${inverse(` ${h.key} `)} ${dim(h.description)}`)
    .join("  ");
}

export function renderStatusBar(state: StatusBarState, width: number): string {
  // Left: Mode name
  const modeText = bold(fg(colors.primary)(state.mode));

  // Center: Custom message or connection status
  const centerText = state.customMessage
    ? dim(state.customMessage)
    : `${connectionIcon(state.connectionStatus)} ${dim(connectionLabel(state.connectionStatus))}`;

  // Calculate spacing
  const leftWidth = visibleLength(modeText);
  const centerWidth = visibleLength(centerText);
  const rightPad = Math.max(0, width - leftWidth - centerWidth - 2);

  return `${modeText}${" ".repeat(Math.floor(rightPad / 2))}${centerText}${" ".repeat(Math.ceil(rightPad / 2))}`;
}

export function renderHintBar(hints: KeyHint[], width: number): string {
  const hintText = renderKeyHints(hints);
  return center(hintText, width);
}

// ─── Full Status Component ───────────────────────────────────────────────────

export function renderStatusComponent(
  state: StatusBarState,
  width: number
): string[] {
  const lines: string[] = [];

  // Separator
  lines.push(dim("─".repeat(width)));

  // Status bar
  lines.push(renderStatusBar(state, width));

  // Key hints
  if (state.keyHints.length > 0) {
    lines.push(renderHintBar(state.keyHints, width));
  }

  return lines;
}

// ─── Common Key Hints ────────────────────────────────────────────────────────

export const CHAT_HINTS: KeyHint[] = [
  { key: "Enter", description: "Send" },
  { key: "Esc", description: "Exit" },
  { key: "↑↓", description: "History" },
  { key: "Ctrl+C", description: "Cancel" },
];

export const PLAN_HINTS: KeyHint[] = [
  { key: "Enter", description: "Approve" },
  { key: "e", description: "Edit" },
  { key: "Esc", description: "Cancel" },
];

export const DEBUG_HINTS: KeyHint[] = [
  { key: "r", description: "Refresh" },
  { key: "Tab", description: "Next panel" },
  { key: "q", description: "Quit" },
];
