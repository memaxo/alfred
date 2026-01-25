/**
 * Cortex Visual Presets
 *
 * Predefined visual configurations for different use cases.
 * These presets balance visual fidelity with performance.
 */

import type { VisualConfig } from "@alfred/type";

/**
 * Minimal preset
 *
 * Lowest resource usage, suitable for low-end devices
 * or when running alongside other intensive applications.
 */
export const PRESET_MINIMAL: VisualConfig = {
  preset: "minimal",
  particles: {
    count: 500,
    spawnRadius: 500,
    gravityConstant: 4000,
    damping: 0.995,
    minDistance: 60,
  },
  corona: {
    fiberCount: 500,
    segmentsPerFiber: 20,
    innerRadius: 150,
    outerRadius: 350,
    rotationSpeed: 0.08,
    spiralTightness: 0.15,
    wobbleAmplitude: 0.1,
  },
  bloom: {
    enabled: false,
    threshold: 0.9,
    intensity: 0.3,
    blurRadius: 1.5,
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0,
  },
  colors: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  atmosphere: {
    enabled: false,
    fogDensity: 0.1,
    fogInnerRadius: 200,
    fogOuterRadius: 500,
    fiberIntensity: 0.04,
    vignetteIntensity: 0.2,
  },
  nodes: {
    glowIntensity: 0.3,
    outerGlowFalloff: 0.08,
    innerGlowIntensity: 0.2,
    ringWidth: 2,
    activityPulseSpeed: 2,
  },
  edges: {
    particleSpeed: 0.1,
    particlesPerEdge: 50,
    curvature: 0.3,
    wobbleAmplitude: 1,
    dormantAlpha: 0.1,
    activeAlpha: 0.6,
  },
};

/**
 * Performance preset
 *
 * Optimized for smooth 60fps on mid-range hardware.
 * Maintains visual appeal while reducing computational load.
 */
export const PRESET_PERFORMANCE: VisualConfig = {
  preset: "performance",
  particles: {
    count: 1500,
    spawnRadius: 600,
    gravityConstant: 5000,
    damping: 0.998,
    minDistance: 50,
  },
  corona: {
    fiberCount: 1000,
    segmentsPerFiber: 35,
    innerRadius: 150,
    outerRadius: 400,
    rotationSpeed: 0.104_72,
    spiralTightness: 0.15,
    wobbleAmplitude: 0.12,
  },
  bloom: {
    enabled: true,
    threshold: 0.85,
    intensity: 0.4,
    blurRadius: 1.5,
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.002,
  },
  colors: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  atmosphere: {
    enabled: true,
    fogDensity: 0.12,
    fogInnerRadius: 200,
    fogOuterRadius: 600,
    fiberIntensity: 0.06,
    vignetteIntensity: 0.25,
  },
  nodes: {
    glowIntensity: 0.4,
    outerGlowFalloff: 0.05,
    innerGlowIntensity: 0.3,
    ringWidth: 2,
    activityPulseSpeed: 3,
  },
  edges: {
    particleSpeed: 0.12,
    particlesPerEdge: 100,
    curvature: 0.3,
    wobbleAmplitude: 1.2,
    dormantAlpha: 0.1,
    activeAlpha: 0.7,
  },
};

/**
 * Balanced preset (default)
 *
 * Good balance between visual quality and performance.
 * Recommended for most users with modern hardware.
 */
export const PRESET_BALANCED: VisualConfig = {
  preset: "balanced",
  particles: {
    count: 3000,
    spawnRadius: 600,
    gravityConstant: 5000,
    damping: 0.998,
    minDistance: 50,
  },
  corona: {
    fiberCount: 2000,
    segmentsPerFiber: 50,
    innerRadius: 150,
    outerRadius: 400,
    rotationSpeed: 0.104_72,
    spiralTightness: 0.15,
    wobbleAmplitude: 0.15,
  },
  bloom: {
    enabled: true,
    threshold: 0.8,
    intensity: 0.5,
    blurRadius: 2,
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.003,
  },
  colors: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  atmosphere: {
    enabled: true,
    fogDensity: 0.15,
    fogInnerRadius: 200,
    fogOuterRadius: 600,
    fiberIntensity: 0.08,
    vignetteIntensity: 0.3,
  },
  nodes: {
    glowIntensity: 0.5,
    outerGlowFalloff: 0.05,
    innerGlowIntensity: 0.4,
    ringWidth: 2,
    activityPulseSpeed: 3,
  },
  edges: {
    particleSpeed: 0.15,
    particlesPerEdge: 200,
    curvature: 0.3,
    wobbleAmplitude: 1.5,
    dormantAlpha: 0.1,
    activeAlpha: 0.8,
  },
};

/**
 * Maximum preset
 *
 * Full visual fidelity with all effects enabled.
 * Requires high-end GPU for smooth performance.
 */
export const PRESET_MAXIMUM: VisualConfig = {
  preset: "maximum",
  particles: {
    count: 8000,
    spawnRadius: 800,
    gravityConstant: 5000,
    damping: 0.998,
    minDistance: 50,
  },
  corona: {
    fiberCount: 3500,
    segmentsPerFiber: 75,
    innerRadius: 150,
    outerRadius: 450,
    rotationSpeed: 0.104_72,
    spiralTightness: 0.15,
    wobbleAmplitude: 0.18,
  },
  bloom: {
    enabled: true,
    threshold: 0.75,
    intensity: 0.6,
    blurRadius: 2.5,
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.004,
  },
  colors: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  atmosphere: {
    enabled: true,
    fogDensity: 0.18,
    fogInnerRadius: 200,
    fogOuterRadius: 700,
    fiberIntensity: 0.1,
    vignetteIntensity: 0.35,
  },
  nodes: {
    glowIntensity: 0.6,
    outerGlowFalloff: 0.04,
    innerGlowIntensity: 0.5,
    ringWidth: 2.5,
    activityPulseSpeed: 3,
  },
  edges: {
    particleSpeed: 0.15,
    particlesPerEdge: 400,
    curvature: 0.3,
    wobbleAmplitude: 1.5,
    dormantAlpha: 0.1,
    activeAlpha: 0.9,
  },
};

/**
 * Preset map for lookup by name
 */
export const VISUAL_PRESETS: Record<string, VisualConfig> = {
  minimal: PRESET_MINIMAL,
  performance: PRESET_PERFORMANCE,
  balanced: PRESET_BALANCED,
  maximum: PRESET_MAXIMUM,
};

/**
 * Get preset by name
 */
export function getPreset(name: string): VisualConfig {
  return VISUAL_PRESETS[name] ?? PRESET_BALANCED;
}

/**
 * Get default preset
 */
export function getDefaultPreset(): VisualConfig {
  return PRESET_BALANCED;
}

/**
 * Preset metadata for UI display
 */
export interface PresetMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

export const PRESET_METADATA: PresetMetadata[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Low resource usage for older hardware",
    icon: "battery-low",
  },
  {
    id: "performance",
    name: "Performance",
    description: "Smooth 60fps on mid-range devices",
    icon: "zap",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Best balance of quality and performance",
    icon: "sliders",
    recommended: true,
  },
  {
    id: "maximum",
    name: "Maximum",
    description: "Full visual fidelity for high-end GPUs",
    icon: "sparkles",
  },
];

/**
 * Merge a partial config with a base preset
 */
export function mergeWithPreset(
  presetName: string,
  overrides: Partial<VisualConfig>
): VisualConfig {
  const base = getPreset(presetName);
  return {
    ...base,
    ...overrides,
    preset: overrides.preset ?? "custom",
    particles: { ...base.particles, ...overrides.particles },
    corona: { ...base.corona, ...overrides.corona },
    bloom: { ...base.bloom, ...overrides.bloom },
    chromaticAberration: {
      ...base.chromaticAberration,
      ...overrides.chromaticAberration,
    },
    colors: { ...base.colors, ...overrides.colors },
    atmosphere: { ...base.atmosphere, ...overrides.atmosphere },
    nodes: { ...base.nodes, ...overrides.nodes },
    edges: { ...base.edges, ...overrides.edges },
  };
}
