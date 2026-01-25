/**
 * ALFRED Orb Visual Constants
 *
 * Color palette and state configuration for the neural orb visualization.
 * Based on the ALFRED design system - nocturnal by design.
 */

// ─── ALFRED Color Palette ────────────────────────────────────────────────────

export const ALFRED_COLORS = {
  // Primary - Alfred's voice, active elements
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

// ─── Orb States ──────────────────────────────────────────────────────────────

export type OrbState =
  | "dormant"
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "acting"
  | "error";

export interface OrbStateConfig {
  corona: string;
  glow: number;
  pulseSpeed: number;
  particleDirection: "inward" | "outward" | "orbital" | "scatter" | "none";
}

export const ORB_STATES: Record<OrbState, OrbStateConfig> = {
  dormant: {
    corona: "#5A6B7D",
    glow: 0.2,
    pulseSpeed: 0.3,
    particleDirection: "none",
  },
  idle: {
    corona: "#00D9FF",
    glow: 0.4,
    pulseSpeed: 0.5,
    particleDirection: "orbital",
  },
  listening: {
    corona: "#00D9FF",
    glow: 0.7,
    pulseSpeed: 1,
    particleDirection: "inward",
  },
  speaking: {
    corona: "#00FF88",
    glow: 0.8,
    pulseSpeed: 1.2,
    particleDirection: "outward",
  },
  thinking: {
    corona: "#FFB800",
    glow: 0.6,
    pulseSpeed: 0.8,
    particleDirection: "orbital",
  },
  acting: {
    corona: "#FF3366",
    glow: 0.9,
    pulseSpeed: 1.5,
    particleDirection: "outward",
  },
  error: {
    corona: "#FF3366",
    glow: 0.8,
    pulseSpeed: 2,
    particleDirection: "scatter",
  },
} as const;

// ─── Animation Constants ─────────────────────────────────────────────────────

export const ANIMATION = {
  // Breathing pulse cycle (ms)
  breatheDuration: 3000,

  // Color transition duration (ms)
  colorTransitionDuration: 300,

  // Particle system
  particleCount: 200,
  particleMaxSpeed: 2,
  connectionDistance: 50,
  connectionOpacity: 0.3,

  // Glow bloom
  glowBlurRadius: 20,
  glowBlurRadiusActive: 35,

  // Corona ring
  coronaNoiseScale: 5,
  coronaNoiseSpeed: 0.1,
  coronaWidth: 0.15,
} as const;

// ─── Size Presets ────────────────────────────────────────────────────────────

export const ORB_SIZES = {
  mini: 48,
  small: 80,
  medium: 160,
  large: 280,
  full: 320,
} as const;

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Parse hex color to RGB components (0-1 range)
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Parse hex color to RGBA array for Skia uniforms
 */
export function hexToRgba(
  hex: string,
  alpha = 1
): [number, number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
}

/**
 * Interpolate between two colors
 */
export function lerpColor(
  colorA: string,
  colorB: string,
  t: number
): [number, number, number] {
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
}
