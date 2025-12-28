/**
 * ALFRED TUI Theme System
 *
 * Dark theme only - ALFRED is nocturnal by design.
 * Color palette inspired by modern terminal aesthetics with semantic meaning.
 */

// ─── Color Palette ───────────────────────────────────────────────────────────

export const colors = {
  // Primary - ALFRED's voice, active elements
  primary: "#00D9FF",

  // Semantic colors
  success: "#00FF88",
  warning: "#FFB800",
  error: "#FF3366",

  // Neutral scale
  muted: "#5A6B7D",
  dim: "#3A4553",

  // Backgrounds
  background: "#0A0E14",
  surface: "#141920",
  surfaceHover: "#1A2129",

  // Text
  text: "#E6E8EB",
  textMuted: "#8899AA",
  textDim: "#5A6B7D",

  // Borders
  border: "#2A3441",
  borderFocus: "#00D9FF",
} as const;

// ─── RGB Values for OpenTUI ──────────────────────────────────────────────────

export function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return [r, g, b, 255];
}

export const rgba = {
  primary: hexToRgba(colors.primary),
  success: hexToRgba(colors.success),
  warning: hexToRgba(colors.warning),
  error: hexToRgba(colors.error),
  muted: hexToRgba(colors.muted),
  text: hexToRgba(colors.text),
  textMuted: hexToRgba(colors.textMuted),
  background: hexToRgba(colors.background),
  surface: hexToRgba(colors.surface),
  border: hexToRgba(colors.border),
} as const;

// ─── Semantic Color Functions ────────────────────────────────────────────────

export type StatusType = "success" | "warning" | "error" | "info" | "neutral";

export function statusColor(status: StatusType): string {
  switch (status) {
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "error":
      return colors.error;
    case "info":
      return colors.primary;
    case "neutral":
      return colors.muted;
  }
}

export function autonomyColor(level: number): string {
  if (level >= 0.7) {
    return colors.success;
  }
  if (level >= 0.5) {
    return colors.primary;
  }
  if (level >= 0.3) {
    return colors.warning;
  }
  return colors.error;
}

export function phaseColor(
  phase:
    | "idle"
    | "capturing"
    | "thinking"
    | "deciding"
    | "executing"
    | "reflecting"
): string {
  switch (phase) {
    case "idle":
      return colors.muted;
    case "capturing":
      return colors.primary;
    case "thinking":
      return colors.warning;
    case "deciding":
      return colors.primary;
    case "executing":
      return colors.success;
    case "reflecting":
      return colors.textMuted;
  }
}

// ─── Spacing Scale ───────────────────────────────────────────────────────────

export const spacing = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
} as const;

// ─── Box Drawing Characters ──────────────────────────────────────────────────

export const box = {
  // Single line
  horizontal: "─",
  vertical: "│",
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  teeLeft: "├",
  teeRight: "┤",
  teeTop: "┬",
  teeBottom: "┴",
  cross: "┼",

  // Double line (for focus/active)
  doubleHorizontal: "═",
  doubleVertical: "║",
  doubleTopLeft: "╔",
  doubleTopRight: "╗",
  doubleBottomLeft: "╚",
  doubleBottomRight: "╝",

  // Rounded (for badges)
  roundedTopLeft: "╭",
  roundedTopRight: "╮",
  roundedBottomLeft: "╰",
  roundedBottomRight: "╯",
} as const;

// ─── Progress Bar Characters ─────────────────────────────────────────────────

export const progressChars = {
  filled: "█",
  half: "▓",
  quarter: "▒",
  empty: "░",
  blocks: ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"],
} as const;

// ─── Sparkline Characters ────────────────────────────────────────────────────

export const sparklineChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

// ─── Status Icons ────────────────────────────────────────────────────────────

export const icons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  pending: "○",
  active: "●",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  arrow: {
    right: "→",
    left: "←",
    up: "↑",
    down: "↓",
  },
} as const;
