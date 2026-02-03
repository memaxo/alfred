import { formatHex, oklch } from "culori";

/**
 * Convert OKLCH color to RGB hex string for React Native StyleSheet
 */
export function oklchToRgb(l: number, c: number, h: number): string {
  const color = oklch({ mode: "oklch", l, c, h });
  return formatHex(color) ?? "#000000";
}

export const VOID_PALETTE = {
  void: {
    absolute: oklchToRgb(0, 0, 0), // #000000 - True black
    deep: oklchToRgb(0.05, 0, 0), // #0a0a0a - Primary background
    surface: oklchToRgb(0.1, 0, 0), // #171717 - Elevated surface
    raised: oklchToRgb(0.14, 0, 0), // #212121 - Cards, modals
  },
  biolum: {
    full: oklchToRgb(0.99, 0, 0), // #fcfcfc - Primary text
    bright: oklchToRgb(0.9, 0, 0), // #e5e5e5 - Emphasis
    standard: oklchToRgb(0.75, 0, 0), // #b3b3b3 - Body text
    dim: oklchToRgb(0.55, 0, 0), // #7a7a7a - Secondary text
    faint: oklchToRgb(0.35, 0, 0), // #4a4a4a - Tertiary/hints
    whisper: oklchToRgb(0.2, 0, 0), // #2e2e2e - Subtle dividers
  },
  glass: {
    surface: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.08)",
    hover: "rgba(255, 255, 255, 0.10)",
    active: "rgba(255, 255, 255, 0.15)",
    glow: "rgba(255, 255, 255, 0.03)",
  },
  semantic: {
    success: "#00FF88", // Green glow for success states
    warning: "#FFB800", // Yellow/orange for warnings
    error: "#FF4444", // Red for errors
    info: oklchToRgb(0.75, 0.05, 230),
  },
  accent: {
    cyan: "#00D9FF", // Primary accent - cyan glow
    purple: "#9D4EDD", // Secondary accent
    gold: "#FFD700", // Tertiary accent
  },
} as const;

export const ATTENTION_SCALE = {
  critical: VOID_PALETTE.biolum.full,
  primary: VOID_PALETTE.biolum.bright,
  secondary: VOID_PALETTE.biolum.standard,
  tertiary: VOID_PALETTE.biolum.dim,
  ambient: VOID_PALETTE.biolum.faint,
} as const;

export const GLOW = {
  subtle: {
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 1,
  },
  medium: {
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 40,
    elevation: 2,
  },
  strong: {
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 60,
    elevation: 3,
  },
  focus: {
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export type VoidPalette = typeof VOID_PALETTE;
export type GlowStyle = typeof GLOW;
