/**
 * ALFRED TUI Typography Helpers
 *
 * Text styling utilities using ANSI escape codes.
 * Works with any terminal that supports ANSI colors.
 */

import { colors, hexToRgba } from "./theme";

// ─── ANSI Escape Codes ───────────────────────────────────────────────────────

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

// ─── Style Modifiers ─────────────────────────────────────────────────────────

export function bold(text: string): string {
  return `${ESC}1m${text}${RESET}`;
}

export function dim(text: string): string {
  return `${ESC}2m${text}${RESET}`;
}

export function italic(text: string): string {
  return `${ESC}3m${text}${RESET}`;
}

export function underline(text: string): string {
  return `${ESC}4m${text}${RESET}`;
}

export function inverse(text: string): string {
  return `${ESC}7m${text}${RESET}`;
}

export function strikethrough(text: string): string {
  return `${ESC}9m${text}${RESET}`;
}

// ─── Color Functions ─────────────────────────────────────────────────────────

/**
 * Apply foreground color using hex code
 */
export function fg(hexColor: string): (text: string) => string {
  const [r, g, b] = hexToRgba(hexColor);
  return (text: string) => `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

/**
 * Apply background color using hex code
 */
export function bg(hexColor: string): (text: string) => string {
  const [r, g, b] = hexToRgba(hexColor);
  return (text: string) => `${ESC}48;2;${r};${g};${b}m${text}${RESET}`;
}

// ─── Semantic Color Helpers ──────────────────────────────────────────────────

export const primary = fg(colors.primary);
export const success = fg(colors.success);
export const warning = fg(colors.warning);
export const error = fg(colors.error);
export const muted = fg(colors.muted);
export const textColor = fg(colors.text);
export const textMuted = fg(colors.textMuted);

// ─── Compound Styles ─────────────────────────────────────────────────────────

export function header(text: string): string {
  return bold(primary(text));
}

export function label(text: string): string {
  return dim(text);
}

export function value(text: string): string {
  return bold(text);
}

export function timestamp(text: string): string {
  return dim(textMuted(text));
}

export function keyHint(key: string, description: string): string {
  return `${inverse(` ${key} `)} ${dim(description)}`;
}

// ─── Progress Bar Rendering ──────────────────────────────────────────────────

export function progressBar(
  value: number,
  width: number,
  options: {
    filled?: string;
    empty?: string;
    color?: string;
  } = {}
): string {
  const { filled = "█", empty = "░", color = colors.primary } = options;
  const clampedValue = Math.max(0, Math.min(1, value));
  const filledCount = Math.round(clampedValue * width);
  const emptyCount = width - filledCount;

  const filledPart = fg(color)(filled.repeat(filledCount));
  const emptyPart = dim(empty.repeat(emptyCount));

  return filledPart + emptyPart;
}

// ─── Sparkline Rendering ─────────────────────────────────────────────────────

const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function sparkline(
  values: number[],
  color: string = colors.primary
): string {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chars = values.map((v) => {
    const normalized = (v - min) / range;
    const index = Math.min(Math.floor(normalized * 8), 7);
    return SPARKLINE_CHARS[index];
  });

  return fg(color)(chars.join(""));
}

// ─── Badge Rendering ─────────────────────────────────────────────────────────

export function badge(
  text: string,
  type: "success" | "warning" | "error" | "info" | "neutral" = "neutral"
): string {
  const colorMap = {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.primary,
    neutral: colors.muted,
  };
  const color = colorMap[type];
  return fg(color)(`[${text}]`);
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

export function horizontalLine(width: number, char = "─"): string {
  return char.repeat(width);
}

export function boxTop(width: number, title?: string, focused = false): string {
  const left = focused ? "╔" : "┌";
  const right = focused ? "╗" : "┐";
  const line = focused ? "═" : "─";

  if (title) {
    const titleText = ` ${title} `;
    const availableWidth = width - 2 - titleText.length;
    const leftPad = 1;
    const rightPad = availableWidth - leftPad;
    return `${left}${line.repeat(leftPad)}${primary(titleText)}${line.repeat(Math.max(0, rightPad))}${right}`;
  }

  return `${left}${line.repeat(width - 2)}${right}`;
}

export function boxBottom(width: number, focused = false): string {
  const left = focused ? "╚" : "└";
  const right = focused ? "╝" : "┘";
  const line = focused ? "═" : "─";
  return `${left}${line.repeat(width - 2)}${right}`;
}

export function boxSide(focused = false): string {
  return focused ? "║" : "│";
}

// ─── Text Utilities ──────────────────────────────────────────────────────────

export function truncate(
  text: string,
  maxLength: number,
  ellipsis = "…"
): string {
  if (visibleLength(text) <= maxLength) {
    return text;
  }

  // Truncate based on visible characters, but preserving ANSI codes is tricky.
  // For now, strip ANSI for truncation if it's too long, or do better:
  // We need to keep ANSI codes while truncating the visible text.

  let result = "";
  let visibleCount = 0;
  let i = 0;

  while (i < text.length && visibleCount < maxLength - ellipsis.length) {
    if (text[i] === "\x1b") {
      const match = text.slice(i).match(/^\x1b\[[0-9;]*m/);
      if (match) {
        result += match[0];
        i += match[0].length;
        continue;
      }
    }
    result += text[i];
    visibleCount++;
    i++;
  }

  return result + ellipsis + RESET;
}

export function padRight(text: string, width: number, char = " "): string {
  const vLen = visibleLength(text);
  if (vLen >= width) {
    return text;
  }
  return text + char.repeat(width - vLen);
}

export function padLeft(text: string, width: number, char = " "): string {
  const vLen = visibleLength(text);
  if (vLen >= width) {
    return text;
  }
  return char.repeat(width - vLen) + text;
}

export function center(text: string, width: number, char = " "): string {
  const vLen = visibleLength(text);
  if (vLen >= width) {
    return text;
  }
  const leftPad = Math.floor((width - vLen) / 2);
  const rightPad = width - vLen - leftPad;
  return char.repeat(leftPad) + text + char.repeat(rightPad);
}

/**
 * Strip ANSI escape codes from string (for length calculation)
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get visible length of string (excluding ANSI codes)
 */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}
