/**
 * Cortex Configuration Tests
 *
 * Tests for visual presets, config validation, and config application.
 * Tests schema validation and config utilities.
 */

import {
  atmosphereConfigSchema,
  bloomConfigSchema,
  COLOR_PALETTES,
  coronaConfigSchema,
  edgeConfigSchema,
  nodeConfigSchema,
  particleConfigSchema,
  type VisualConfig,
  visualConfigExportSchema,
  visualConfigSchema,
  visualPresetSchema,
} from "@alfred/type";
import { describe, expect, it } from "bun:test";

import { interpolateConfig, parseOklch, rgbToOklch } from "../src/config";
import {
  getDefaultPreset,
  getPreset,
  mergeWithPreset,
  PRESET_BALANCED,
  PRESET_MAXIMUM,
  PRESET_METADATA,
  PRESET_MINIMAL,
  PRESET_PERFORMANCE,
  VISUAL_PRESETS,
} from "../src/presets";

describe("Visual Preset Schema Validation", () => {
  it("validates valid preset names", () => {
    expect(visualPresetSchema.safeParse("minimal").success).toBe(true);
    expect(visualPresetSchema.safeParse("balanced").success).toBe(true);
    expect(visualPresetSchema.safeParse("performance").success).toBe(true);
    expect(visualPresetSchema.safeParse("maximum").success).toBe(true);
    expect(visualPresetSchema.safeParse("custom").success).toBe(true);
  });

  it("rejects invalid preset names", () => {
    expect(visualPresetSchema.safeParse("invalid").success).toBe(false);
    expect(visualPresetSchema.safeParse("").success).toBe(false);
    expect(visualPresetSchema.safeParse(123).success).toBe(false);
  });
});

describe("Particle Config Schema", () => {
  it("validates valid particle config", () => {
    const config = {
      count: 3000,
      spawnRadius: 600,
      gravityConstant: 5000,
      damping: 0.998,
      minDistance: 50,
    };
    expect(particleConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces count constraints", () => {
    expect(particleConfigSchema.safeParse({ count: 50 }).success).toBe(false); // < 100
    expect(particleConfigSchema.safeParse({ count: 15_000 }).success).toBe(
      false
    ); // > 10000
    expect(particleConfigSchema.safeParse({ count: 100 }).success).toBe(true);
    expect(particleConfigSchema.safeParse({ count: 10_000 }).success).toBe(
      true
    );
  });

  it("enforces damping constraints", () => {
    expect(particleConfigSchema.safeParse({ damping: 0.5 }).success).toBe(
      false
    ); // < 0.9
    expect(particleConfigSchema.safeParse({ damping: 1.5 }).success).toBe(
      false
    ); // > 0.999
    expect(particleConfigSchema.safeParse({ damping: 0.95 }).success).toBe(
      true
    );
  });
});

describe("Corona Config Schema", () => {
  it("validates valid corona config", () => {
    const config = {
      fiberCount: 2000,
      segmentsPerFiber: 50,
      innerRadius: 150,
      outerRadius: 400,
      rotationSpeed: 0.1,
      spiralTightness: 0.15,
      wobbleAmplitude: 0.15,
    };
    expect(coronaConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces fiber count constraints", () => {
    expect(coronaConfigSchema.safeParse({ fiberCount: 100 }).success).toBe(
      false
    ); // < 200
    expect(coronaConfigSchema.safeParse({ fiberCount: 6000 }).success).toBe(
      false
    ); // > 5000
    expect(coronaConfigSchema.safeParse({ fiberCount: 200 }).success).toBe(
      true
    );
    expect(coronaConfigSchema.safeParse({ fiberCount: 5000 }).success).toBe(
      true
    );
  });
});

describe("Bloom Config Schema", () => {
  it("validates valid bloom config", () => {
    const config = {
      enabled: true,
      threshold: 0.8,
      intensity: 0.5,
      blurRadius: 2.0,
    };
    expect(bloomConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces threshold and intensity constraints", () => {
    expect(bloomConfigSchema.safeParse({ threshold: -0.1 }).success).toBe(
      false
    );
    expect(bloomConfigSchema.safeParse({ threshold: 2.5 }).success).toBe(false);
    expect(bloomConfigSchema.safeParse({ intensity: -0.1 }).success).toBe(
      false
    );
    expect(bloomConfigSchema.safeParse({ intensity: 2.5 }).success).toBe(false);
  });
});

describe("Atmosphere Config Schema", () => {
  it("validates valid atmosphere config", () => {
    const config = {
      enabled: true,
      fogDensity: 0.15,
      fogInnerRadius: 200,
      fogOuterRadius: 600,
      fiberIntensity: 0.08,
      vignetteIntensity: 0.3,
    };
    expect(atmosphereConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces fog density constraints", () => {
    expect(atmosphereConfigSchema.safeParse({ fogDensity: -0.1 }).success).toBe(
      false
    );
    expect(atmosphereConfigSchema.safeParse({ fogDensity: 0.6 }).success).toBe(
      false
    );
  });
});

describe("Node Config Schema", () => {
  it("validates valid node config", () => {
    const config = {
      glowIntensity: 0.5,
      outerGlowFalloff: 0.05,
      innerGlowIntensity: 0.4,
      ringWidth: 2,
      activityPulseSpeed: 3,
    };
    expect(nodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces glow intensity constraints", () => {
    expect(nodeConfigSchema.safeParse({ glowIntensity: -0.1 }).success).toBe(
      false
    );
    expect(nodeConfigSchema.safeParse({ glowIntensity: 1.5 }).success).toBe(
      false
    );
  });
});

describe("Edge Config Schema", () => {
  it("validates valid edge config", () => {
    const config = {
      particleSpeed: 0.15,
      particlesPerEdge: 200,
      curvature: 0.3,
      wobbleAmplitude: 1.5,
      dormantAlpha: 0.1,
      activeAlpha: 0.8,
    };
    expect(edgeConfigSchema.safeParse(config).success).toBe(true);
  });

  it("enforces alpha constraints", () => {
    expect(edgeConfigSchema.safeParse({ dormantAlpha: 0.6 }).success).toBe(
      false
    ); // > 0.5
    expect(edgeConfigSchema.safeParse({ activeAlpha: 0.2 }).success).toBe(
      false
    ); // < 0.3
  });
});

describe("Visual Config Schema", () => {
  it("validates complete config", () => {
    expect(visualConfigSchema.safeParse(PRESET_BALANCED).success).toBe(true);
    expect(visualConfigSchema.safeParse(PRESET_MINIMAL).success).toBe(true);
    expect(visualConfigSchema.safeParse(PRESET_PERFORMANCE).success).toBe(true);
    expect(visualConfigSchema.safeParse(PRESET_MAXIMUM).success).toBe(true);
  });

  it("applies defaults for missing nested values", () => {
    const partial = {
      preset: "balanced" as const,
      particles: { count: 1000 },
      corona: { fiberCount: 500 },
      bloom: { enabled: false },
      chromaticAberration: { enabled: false },
      colors: { primary: "oklch(0.8 0.1 200)" },
      atmosphere: { enabled: false },
      nodes: { glowIntensity: 0.5 },
      edges: { particleSpeed: 0.2 },
    };
    const result = visualConfigSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      // Defaults should be applied
      expect(result.data.particles.spawnRadius).toBe(600);
      expect(result.data.corona.segmentsPerFiber).toBe(50);
    }
  });
});

describe("Preset Definitions", () => {
  it("PRESET_MINIMAL has lowest values", () => {
    expect(PRESET_MINIMAL.preset).toBe("minimal");
    expect(PRESET_MINIMAL.particles.count).toBeLessThan(
      PRESET_BALANCED.particles.count
    );
    expect(PRESET_MINIMAL.corona.fiberCount).toBeLessThan(
      PRESET_BALANCED.corona.fiberCount
    );
    expect(PRESET_MINIMAL.bloom.enabled).toBe(false);
  });

  it("PRESET_PERFORMANCE has moderate values", () => {
    expect(PRESET_PERFORMANCE.preset).toBe("performance");
    expect(PRESET_PERFORMANCE.particles.count).toBeGreaterThan(
      PRESET_MINIMAL.particles.count
    );
    expect(PRESET_PERFORMANCE.particles.count).toBeLessThan(
      PRESET_BALANCED.particles.count
    );
  });

  it("PRESET_BALANCED is the default", () => {
    expect(PRESET_BALANCED.preset).toBe("balanced");
    expect(getDefaultPreset()).toEqual(PRESET_BALANCED);
  });

  it("PRESET_MAXIMUM has highest values", () => {
    expect(PRESET_MAXIMUM.preset).toBe("maximum");
    expect(PRESET_MAXIMUM.particles.count).toBeGreaterThan(
      PRESET_BALANCED.particles.count
    );
    expect(PRESET_MAXIMUM.corona.fiberCount).toBeGreaterThan(
      PRESET_BALANCED.corona.fiberCount
    );
  });

  it("all presets are valid configs", () => {
    for (const preset of Object.values(VISUAL_PRESETS)) {
      const result = visualConfigSchema.safeParse(preset);
      expect(result.success).toBe(true);
    }
  });
});

describe("getPreset", () => {
  it("returns correct preset by name", () => {
    expect(getPreset("minimal")).toBe(PRESET_MINIMAL);
    expect(getPreset("balanced")).toBe(PRESET_BALANCED);
    expect(getPreset("performance")).toBe(PRESET_PERFORMANCE);
    expect(getPreset("maximum")).toBe(PRESET_MAXIMUM);
  });

  it("returns balanced for unknown preset", () => {
    expect(getPreset("unknown")).toBe(PRESET_BALANCED);
    expect(getPreset("")).toBe(PRESET_BALANCED);
  });
});

describe("mergeWithPreset", () => {
  it("merges partial overrides with base preset", () => {
    const merged = mergeWithPreset("balanced", {
      particles: { count: 5000 },
    });
    expect(merged.particles.count).toBe(5000);
    // Other particle values should be from balanced
    expect(merged.particles.spawnRadius).toBe(
      PRESET_BALANCED.particles.spawnRadius
    );
    // Other sections should be from balanced
    expect(merged.corona.fiberCount).toBe(PRESET_BALANCED.corona.fiberCount);
  });

  it("sets preset to custom when overriding", () => {
    const merged = mergeWithPreset("balanced", {
      particles: { count: 5000 },
    });
    expect(merged.preset).toBe("custom");
  });

  it("preserves explicit preset override", () => {
    const merged = mergeWithPreset("balanced", {
      preset: "minimal",
      particles: { count: 5000 },
    });
    expect(merged.preset).toBe("minimal");
  });

  it("deep merges nested objects", () => {
    const merged = mergeWithPreset("minimal", {
      bloom: { enabled: true, intensity: 0.7 },
    });
    expect(merged.bloom.enabled).toBe(true);
    expect(merged.bloom.intensity).toBe(0.7);
    expect(merged.bloom.threshold).toBe(PRESET_MINIMAL.bloom.threshold);
  });
});

describe("PRESET_METADATA", () => {
  it("has metadata for all presets", () => {
    const presetIds = PRESET_METADATA.map((m) => m.id);
    expect(presetIds).toContain("minimal");
    expect(presetIds).toContain("performance");
    expect(presetIds).toContain("balanced");
    expect(presetIds).toContain("maximum");
  });

  it("marks balanced as recommended", () => {
    const balanced = PRESET_METADATA.find((m) => m.id === "balanced");
    expect(balanced?.recommended).toBe(true);
  });

  it("all metadata has required fields", () => {
    for (const meta of PRESET_METADATA) {
      expect(meta.id).toBeDefined();
      expect(meta.name).toBeDefined();
      expect(meta.description).toBeDefined();
      expect(meta.icon).toBeDefined();
    }
  });
});

describe("interpolateConfig", () => {
  it("returns from config at t=0", () => {
    const result = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 0);
    expect(result.particles.count).toBe(PRESET_MINIMAL.particles.count);
    expect(result.corona.fiberCount).toBe(PRESET_MINIMAL.corona.fiberCount);
  });

  it("returns to config at t=1", () => {
    const result = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 1);
    expect(result.particles.count).toBe(PRESET_MAXIMUM.particles.count);
    expect(result.corona.fiberCount).toBe(PRESET_MAXIMUM.corona.fiberCount);
  });

  it("interpolates numeric values at midpoint", () => {
    const result = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 0.5);
    const expectedParticles = Math.round(
      (PRESET_MINIMAL.particles.count + PRESET_MAXIMUM.particles.count) / 2
    );
    expect(result.particles.count).toBe(expectedParticles);
  });

  it("rounds integer values", () => {
    const result = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 0.3);
    expect(Number.isInteger(result.particles.count)).toBe(true);
    expect(Number.isInteger(result.corona.fiberCount)).toBe(true);
    expect(Number.isInteger(result.edges.particlesPerEdge)).toBe(true);
  });

  it("snaps booleans at midpoint", () => {
    const from: VisualConfig = {
      ...PRESET_MINIMAL,
      bloom: { ...PRESET_MINIMAL.bloom, enabled: false },
    };
    const to: VisualConfig = {
      ...PRESET_MAXIMUM,
      bloom: { ...PRESET_MAXIMUM.bloom, enabled: true },
    };

    expect(interpolateConfig(from, to, 0.4).bloom.enabled).toBe(false);
    expect(interpolateConfig(from, to, 0.6).bloom.enabled).toBe(true);
  });

  it("snaps colors at midpoint", () => {
    const result = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 0.4);
    expect(result.colors).toEqual(PRESET_MINIMAL.colors);

    const result2 = interpolateConfig(PRESET_MINIMAL, PRESET_MAXIMUM, 0.6);
    expect(result2.colors).toEqual(PRESET_MAXIMUM.colors);
  });
});

describe("OKLCH Color Parsing", () => {
  it("parseOklch parses valid color", () => {
    const rgb = parseOklch("oklch(0.85 0.15 180)");
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(1);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(1);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(1);
  });

  it("parseOklch returns black for invalid format", () => {
    const rgb = parseOklch("invalid");
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it("parseOklch handles pure white", () => {
    const rgb = parseOklch("oklch(0.99 0 0)");
    expect(rgb.r).toBeGreaterThan(0.9);
    expect(rgb.g).toBeGreaterThan(0.9);
    expect(rgb.b).toBeGreaterThan(0.9);
  });

  it("parseOklch handles pure black", () => {
    const rgb = parseOklch("oklch(0.05 0 0)");
    expect(rgb.r).toBeLessThan(0.1);
    expect(rgb.g).toBeLessThan(0.1);
    expect(rgb.b).toBeLessThan(0.1);
  });
});

describe("RGB to OKLCH Conversion", () => {
  it("rgbToOklch produces valid format", () => {
    const oklch = rgbToOklch(0.5, 0.5, 0.5);
    expect(oklch).toMatch(/^oklch\(\d+\.\d+ \d+\.\d+ \d+\.\d+\)$/);
  });

  it("round-trip conversion is approximately consistent", () => {
    // Note: Due to gamut clipping, exact round-trip is not guaranteed
    const original = { r: 0.5, g: 0.3, b: 0.7 };
    const oklch = rgbToOklch(original.r, original.g, original.b);
    const back = parseOklch(oklch);

    // Allow some tolerance due to color space conversion approximations
    expect(Math.abs(back.r - original.r)).toBeLessThan(0.15);
    expect(Math.abs(back.g - original.g)).toBeLessThan(0.15);
    expect(Math.abs(back.b - original.b)).toBeLessThan(0.15);
  });
});

describe("Color Palettes", () => {
  it("all palettes have required keys", () => {
    for (const [_name, palette] of Object.entries(COLOR_PALETTES)) {
      expect(palette.primary).toBeDefined();
      expect(palette.secondary).toBeDefined();
      expect(palette.accent).toBeDefined();
      expect(palette.void).toBeDefined();
      expect(palette.biolum).toBeDefined();
    }
  });

  it("all palette colors are valid oklch", () => {
    for (const palette of Object.values(COLOR_PALETTES)) {
      for (const color of Object.values(palette)) {
        expect(color).toMatch(/^oklch\(/);
        const rgb = parseOklch(color);
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.g).toBeGreaterThanOrEqual(0);
        expect(rgb.b).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("void colors are dark", () => {
    for (const palette of Object.values(COLOR_PALETTES)) {
      const voidRgb = parseOklch(palette.void);
      expect(voidRgb.r).toBeLessThan(0.2);
      expect(voidRgb.g).toBeLessThan(0.2);
      expect(voidRgb.b).toBeLessThan(0.2);
    }
  });

  it("biolum colors are bright", () => {
    for (const palette of Object.values(COLOR_PALETTES)) {
      const biolumRgb = parseOklch(palette.biolum);
      const brightness = (biolumRgb.r + biolumRgb.g + biolumRgb.b) / 3;
      expect(brightness).toBeGreaterThan(0.7);
    }
  });
});

describe("Visual Config Export Schema", () => {
  it("validates valid export", () => {
    const exportObj = {
      version: 1 as const,
      name: "My Config",
      description: "A custom configuration",
      config: PRESET_BALANCED,
      exportedAt: new Date().toISOString(),
    };
    expect(visualConfigExportSchema.safeParse(exportObj).success).toBe(true);
  });

  it("requires version 1", () => {
    const exportObj = {
      version: 2,
      config: PRESET_BALANCED,
      exportedAt: new Date().toISOString(),
    };
    expect(visualConfigExportSchema.safeParse(exportObj).success).toBe(false);
  });

  it("requires valid datetime", () => {
    const exportObj = {
      version: 1 as const,
      config: PRESET_BALANCED,
      exportedAt: "not-a-date",
    };
    expect(visualConfigExportSchema.safeParse(exportObj).success).toBe(false);
  });

  it("enforces name length", () => {
    const exportObj = {
      version: 1 as const,
      name: "a".repeat(101), // > 100
      config: PRESET_BALANCED,
      exportedAt: new Date().toISOString(),
    };
    expect(visualConfigExportSchema.safeParse(exportObj).success).toBe(false);
  });
});
