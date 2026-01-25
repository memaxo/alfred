/**
 * Visual Configuration Types
 *
 * Schema definitions for Cortex visual preferences and presets.
 */

import { z } from "zod";

/**
 * Visual preset options
 */
export const visualPresetSchema = z.enum([
  "minimal",
  "balanced",
  "performance",
  "maximum",
  "custom",
]);

export type VisualPreset = z.infer<typeof visualPresetSchema>;

/**
 * Particle system configuration
 */
export const particleConfigSchema = z.object({
  count: z.number().int().min(100).max(10_000).default(3000),
  spawnRadius: z.number().min(200).max(1200).default(600),
  gravityConstant: z.number().min(1000).max(10_000).default(5000),
  damping: z.number().min(0.9).max(0.999).default(0.998),
  minDistance: z.number().min(20).max(100).default(50),
});

export type ParticleConfig = z.infer<typeof particleConfigSchema>;

/**
 * Corona fiber configuration
 */
export const coronaConfigSchema = z.object({
  fiberCount: z.number().int().min(200).max(5000).default(2000),
  segmentsPerFiber: z.number().int().min(10).max(100).default(50),
  innerRadius: z.number().min(50).max(300).default(150),
  outerRadius: z.number().min(200).max(800).default(400),
  rotationSpeed: z.number().min(0.01).max(0.5).default(0.104_72),
  spiralTightness: z.number().min(0.05).max(0.5).default(0.15),
  wobbleAmplitude: z.number().min(0).max(0.5).default(0.15),
});

export type CoronaConfig = z.infer<typeof coronaConfigSchema>;

/**
 * Post-processing bloom configuration
 */
export const bloomConfigSchema = z.object({
  enabled: z.boolean().default(true),
  threshold: z.number().min(0).max(2).default(0.8),
  intensity: z.number().min(0).max(2).default(0.5),
  blurRadius: z.number().min(0.5).max(5).default(2),
});

export type BloomConfig = z.infer<typeof bloomConfigSchema>;

/**
 * Chromatic aberration configuration
 */
export const chromaticAberrationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intensity: z.number().min(0).max(0.02).default(0.003),
});

export type ChromaticAberrationConfig = z.infer<
  typeof chromaticAberrationConfigSchema
>;

/**
 * Color configuration (oklch format strings)
 */
export const colorConfigSchema = z.object({
  primary: z.string().default("oklch(0.85 0.15 180)"), // Teal
  secondary: z.string().default("oklch(0.80 0.12 210)"), // Cyan
  accent: z.string().default("oklch(0.75 0.15 60)"), // Amber
  void: z.string().default("oklch(0.05 0 0)"), // Near black
  biolum: z.string().default("oklch(0.99 0 0)"), // Pure white glow
});

export type ColorConfig = z.infer<typeof colorConfigSchema>;

/**
 * Atmosphere configuration
 */
export const atmosphereConfigSchema = z.object({
  enabled: z.boolean().default(true),
  fogDensity: z.number().min(0).max(0.5).default(0.15),
  fogInnerRadius: z.number().min(100).max(400).default(200),
  fogOuterRadius: z.number().min(400).max(1000).default(600),
  fiberIntensity: z.number().min(0).max(0.2).default(0.08),
  vignetteIntensity: z.number().min(0).max(1).default(0.3),
});

export type AtmosphereConfig = z.infer<typeof atmosphereConfigSchema>;

/**
 * Node rendering configuration
 */
export const nodeConfigSchema = z.object({
  glowIntensity: z.number().min(0).max(1).default(0.5),
  outerGlowFalloff: z.number().min(0.01).max(0.1).default(0.05),
  innerGlowIntensity: z.number().min(0).max(1).default(0.4),
  ringWidth: z.number().min(1).max(5).default(2),
  activityPulseSpeed: z.number().min(0.5).max(10).default(3),
});

export type NodeConfig = z.infer<typeof nodeConfigSchema>;

/**
 * Edge rendering configuration
 */
export const edgeConfigSchema = z.object({
  particleSpeed: z.number().min(0.05).max(0.5).default(0.15),
  particlesPerEdge: z.number().int().min(20).max(500).default(200),
  curvature: z.number().min(0).max(0.8).default(0.3),
  wobbleAmplitude: z.number().min(0).max(3).default(1.5),
  dormantAlpha: z.number().min(0).max(0.5).default(0.1),
  activeAlpha: z.number().min(0.3).max(1).default(0.8),
});

export type EdgeConfig = z.infer<typeof edgeConfigSchema>;

/**
 * Complete visual configuration
 */
export const visualConfigSchema = z.object({
  preset: visualPresetSchema.default("balanced"),
  particles: particleConfigSchema,
  corona: coronaConfigSchema,
  bloom: bloomConfigSchema,
  chromaticAberration: chromaticAberrationConfigSchema,
  colors: colorConfigSchema,
  atmosphere: atmosphereConfigSchema,
  nodes: nodeConfigSchema,
  edges: edgeConfigSchema,
});

export type VisualConfig = z.infer<typeof visualConfigSchema>;

/**
 * Partial visual config for updates
 */
export const visualConfigUpdateSchema = z.object({
  preset: visualPresetSchema.optional(),
  particles: particleConfigSchema.partial().optional(),
  corona: coronaConfigSchema.partial().optional(),
  bloom: bloomConfigSchema.partial().optional(),
  chromaticAberration: chromaticAberrationConfigSchema.partial().optional(),
  colors: colorConfigSchema.partial().optional(),
  atmosphere: atmosphereConfigSchema.partial().optional(),
  nodes: nodeConfigSchema.partial().optional(),
  edges: edgeConfigSchema.partial().optional(),
});

export type VisualConfigUpdate = z.infer<typeof visualConfigUpdateSchema>;

/**
 * Visual preference key pattern
 * Matches: visual.*, visual.particles.count, visual.bloom.intensity, etc.
 */
export const visualPreferenceKeyPattern =
  /^visual(\.[a-zA-Z]+)*(\.[a-zA-Z]+)?$/;

export const visualPreferenceKeySchema = z
  .string()
  .regex(visualPreferenceKeyPattern, "Invalid visual preference key");

/**
 * Color palette presets
 */
export const colorPaletteSchema = z.enum([
  "teal", // Default teal/cyan
  "purple", // Purple/violet
  "amber", // Amber/orange
  "emerald", // Green
  "rose", // Pink/red
]);

export type ColorPalette = z.infer<typeof colorPaletteSchema>;

/**
 * Color palette definitions
 */
export const COLOR_PALETTES: Record<ColorPalette, ColorConfig> = {
  teal: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  purple: {
    primary: "oklch(0.70 0.20 300)",
    secondary: "oklch(0.75 0.15 280)",
    accent: "oklch(0.80 0.15 340)",
    void: "oklch(0.05 0.02 280)",
    biolum: "oklch(0.95 0.05 300)",
  },
  amber: {
    primary: "oklch(0.80 0.18 60)",
    secondary: "oklch(0.75 0.15 80)",
    accent: "oklch(0.85 0.12 40)",
    void: "oklch(0.06 0.02 60)",
    biolum: "oklch(0.95 0.05 60)",
  },
  emerald: {
    primary: "oklch(0.75 0.18 150)",
    secondary: "oklch(0.80 0.12 130)",
    accent: "oklch(0.70 0.15 170)",
    void: "oklch(0.05 0.02 150)",
    biolum: "oklch(0.95 0.05 150)",
  },
  rose: {
    primary: "oklch(0.75 0.18 0)",
    secondary: "oklch(0.80 0.15 350)",
    accent: "oklch(0.70 0.20 20)",
    void: "oklch(0.05 0.02 0)",
    biolum: "oklch(0.95 0.05 0)",
  },
};

/**
 * Export/import format for sharing configs
 */
export const visualConfigExportSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: visualConfigSchema,
  exportedAt: z.string().datetime(),
});

export type VisualConfigExport = z.infer<typeof visualConfigExportSchema>;
