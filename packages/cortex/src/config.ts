/**
 * Cortex Configuration Application
 *
 * Utilities for applying visual configurations to the Cortex engine
 * and synchronizing with render systems.
 */

import type { VisualConfig } from "@alfred/type";

import type { CortexEngine } from "./engine";
import type { CoronaSystem } from "./systems/corona";
import type { ParticleSystem } from "./systems/particles";
import type { PostProcessSystem } from "./systems/postprocess";

import { getPreset, mergeWithPreset } from "./presets";

/**
 * Apply a visual configuration to the Cortex engine
 *
 * Updates all render systems with the new configuration values.
 * Changes take effect on the next frame.
 */
export function applyVisualConfig(
  engine: CortexEngine,
  config: VisualConfig
): void {
  // Particle system
  const particleSystem = engine.getSystem<ParticleSystem>("particles");
  if (particleSystem) {
    particleSystem.setParticleCount(config.particles.count);
    // Note: Other particle params would require shader updates
  }

  // Corona system
  const coronaSystem = engine.getSystem<CoronaSystem>("corona");
  if (coronaSystem) {
    coronaSystem.setFiberCount(config.corona.fiberCount);
    coronaSystem.setOrbConfig({
      center: engine.getCamera().center,
      innerRadius: config.corona.innerRadius,
      outerRadius: config.corona.outerRadius,
      state: "idle",
      fiberCount: config.corona.fiberCount,
      segmentsPerFiber: config.corona.segmentsPerFiber,
      rotationSpeed: config.corona.rotationSpeed,
    });
  }

  // Post-processing
  const postProcess = engine.getSystem<PostProcessSystem>("postprocess");
  if (postProcess) {
    postProcess.setConfig({
      threshold: config.bloom.threshold,
      intensity: config.bloom.enabled ? config.bloom.intensity : 0,
      blurRadius: config.bloom.blurRadius,
    });
  }

  // Node system - glowIntensity affects rendering
  // Note: Deep shader integration would require uniform updates

  // Edge system - curvature and particle speed
  // Note: These would need to be exposed on EdgeSystem

  // Store config reference on engine for later retrieval
  (engine as EngineWithConfig).__visualConfig = config;
}

/**
 * Apply a preset by name
 */
export function applyPreset(engine: CortexEngine, presetName: string): void {
  const config = getPreset(presetName);
  applyVisualConfig(engine, config);
}

/**
 * Apply partial config updates, merging with current config
 */
export function updateVisualConfig(
  engine: CortexEngine,
  updates: Partial<VisualConfig>
): void {
  const current = getVisualConfig(engine);
  const merged = mergeWithPreset(current.preset, { ...current, ...updates });
  applyVisualConfig(engine, merged);
}

/**
 * Get the current visual configuration from the engine
 */
export function getVisualConfig(engine: CortexEngine): VisualConfig {
  const engineWithConfig = engine as EngineWithConfig;
  return engineWithConfig.__visualConfig ?? getPreset("balanced");
}

/**
 * Engine with stored visual config
 */
interface EngineWithConfig extends CortexEngine {
  __visualConfig?: VisualConfig;
}

/**
 * Parse oklch color string to RGB
 * oklch(L C H) where L is 0-1, C is 0-0.4, H is 0-360
 */
export function parseOklch(oklch: string): {
  r: number;
  g: number;
  b: number;
} {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) {
    return { r: 0, g: 0, b: 0 };
  }

  const L = Number.parseFloat(match[1] ?? "0");
  const C = Number.parseFloat(match[2] ?? "0");
  const H = Number.parseFloat(match[3] ?? "0");

  // Simplified oklch to RGB conversion
  // This is an approximation - full conversion requires more complex math
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab to linear RGB (simplified)
  const l_ = L + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const m_ = L - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const s_ = L - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s;
  const gLin = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s;
  const bLin = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s;

  // Linear to sRGB
  const toSrgb = (c: number) => {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.003_130_8
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };

  return {
    r: toSrgb(rLin),
    g: toSrgb(gLin),
    b: toSrgb(bLin),
  };
}

/**
 * Convert RGB to oklch string
 */
export function rgbToOklch(r: number, g: number, b: number): string {
  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  // Linear RGB to OKLab
  const l =
    0.412_221_470_8 * rLin + 0.536_332_536_3 * gLin + 0.051_445_992_9 * bLin;
  const m =
    0.211_903_498_2 * rLin + 0.680_699_545_1 * gLin + 0.107_396_956_6 * bLin;
  const s =
    0.088_302_461_9 * rLin + 0.281_718_837_6 * gLin + 0.629_978_700_5 * bLin;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.210_454_255_3 * l_ + 0.793_617_785 * m_ - 0.004_072_046_8 * s_;
  const a = 1.977_998_495_1 * l_ - 2.428_592_205 * m_ + 0.450_593_709_9 * s_;
  const bOk = 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766 * s_;

  // OKLab to OKLCH
  const C = Math.sqrt(a * a + bOk * bOk);
  let H = (Math.atan2(bOk, a) * 180) / Math.PI;
  if (H < 0) {
    H += 360;
  }

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/**
 * Interpolate between two visual configs
 * Useful for smooth transitions between presets
 */
export function interpolateConfig(
  from: VisualConfig,
  to: VisualConfig,
  t: number
): VisualConfig {
  const lerp = (a: number, b: number) => a + (b - a) * t;

  return {
    preset: t < 0.5 ? from.preset : to.preset,
    particles: {
      count: Math.round(lerp(from.particles.count, to.particles.count)),
      spawnRadius: lerp(from.particles.spawnRadius, to.particles.spawnRadius),
      gravityConstant: lerp(
        from.particles.gravityConstant,
        to.particles.gravityConstant
      ),
      damping: lerp(from.particles.damping, to.particles.damping),
      minDistance: lerp(from.particles.minDistance, to.particles.minDistance),
    },
    corona: {
      fiberCount: Math.round(
        lerp(from.corona.fiberCount, to.corona.fiberCount)
      ),
      segmentsPerFiber: Math.round(
        lerp(from.corona.segmentsPerFiber, to.corona.segmentsPerFiber)
      ),
      innerRadius: lerp(from.corona.innerRadius, to.corona.innerRadius),
      outerRadius: lerp(from.corona.outerRadius, to.corona.outerRadius),
      rotationSpeed: lerp(from.corona.rotationSpeed, to.corona.rotationSpeed),
      spiralTightness: lerp(
        from.corona.spiralTightness,
        to.corona.spiralTightness
      ),
      wobbleAmplitude: lerp(
        from.corona.wobbleAmplitude,
        to.corona.wobbleAmplitude
      ),
    },
    bloom: {
      enabled: t < 0.5 ? from.bloom.enabled : to.bloom.enabled,
      threshold: lerp(from.bloom.threshold, to.bloom.threshold),
      intensity: lerp(from.bloom.intensity, to.bloom.intensity),
      blurRadius: lerp(from.bloom.blurRadius, to.bloom.blurRadius),
    },
    chromaticAberration: {
      enabled:
        t < 0.5
          ? from.chromaticAberration.enabled
          : to.chromaticAberration.enabled,
      intensity: lerp(
        from.chromaticAberration.intensity,
        to.chromaticAberration.intensity
      ),
    },
    // Colors don't interpolate well - snap at midpoint
    colors: t < 0.5 ? from.colors : to.colors,
    atmosphere: {
      enabled: t < 0.5 ? from.atmosphere.enabled : to.atmosphere.enabled,
      fogDensity: lerp(from.atmosphere.fogDensity, to.atmosphere.fogDensity),
      fogInnerRadius: lerp(
        from.atmosphere.fogInnerRadius,
        to.atmosphere.fogInnerRadius
      ),
      fogOuterRadius: lerp(
        from.atmosphere.fogOuterRadius,
        to.atmosphere.fogOuterRadius
      ),
      fiberIntensity: lerp(
        from.atmosphere.fiberIntensity,
        to.atmosphere.fiberIntensity
      ),
      vignetteIntensity: lerp(
        from.atmosphere.vignetteIntensity,
        to.atmosphere.vignetteIntensity
      ),
    },
    nodes: {
      glowIntensity: lerp(from.nodes.glowIntensity, to.nodes.glowIntensity),
      outerGlowFalloff: lerp(
        from.nodes.outerGlowFalloff,
        to.nodes.outerGlowFalloff
      ),
      innerGlowIntensity: lerp(
        from.nodes.innerGlowIntensity,
        to.nodes.innerGlowIntensity
      ),
      ringWidth: lerp(from.nodes.ringWidth, to.nodes.ringWidth),
      activityPulseSpeed: lerp(
        from.nodes.activityPulseSpeed,
        to.nodes.activityPulseSpeed
      ),
    },
    edges: {
      particleSpeed: lerp(from.edges.particleSpeed, to.edges.particleSpeed),
      particlesPerEdge: Math.round(
        lerp(from.edges.particlesPerEdge, to.edges.particlesPerEdge)
      ),
      curvature: lerp(from.edges.curvature, to.edges.curvature),
      wobbleAmplitude: lerp(
        from.edges.wobbleAmplitude,
        to.edges.wobbleAmplitude
      ),
      dormantAlpha: lerp(from.edges.dormantAlpha, to.edges.dormantAlpha),
      activeAlpha: lerp(from.edges.activeAlpha, to.edges.activeAlpha),
    },
  };
}

/**
 * Animate between two configs over time
 */
export function animateConfig(
  engine: CortexEngine,
  from: VisualConfig,
  to: VisualConfig,
  durationMs: number,
  onComplete?: () => void
): () => void {
  const startTime = performance.now();
  let animationId: number;

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / durationMs, 1);

    // Ease out cubic
    const eased = 1 - (1 - t) ** 3;

    const interpolated = interpolateConfig(from, to, eased);
    applyVisualConfig(engine, interpolated);

    if (t < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };

  animationId = requestAnimationFrame(animate);

  // Return cancel function
  return () => {
    cancelAnimationFrame(animationId);
  };
}
