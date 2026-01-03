/**
 * Performance Utilities for the Orb
 *
 * Detects device capabilities and provides optimized settings
 * to maintain 60fps across different devices.
 */

import { useMemo } from "react";
import { Dimensions, Platform } from "react-native";

// ─── Types ───────────────────────────────────────────────────────────────────

type PerformanceTier = "low" | "medium" | "high";

type PerformanceConfig = {
  /** Performance tier for this device */
  tier: PerformanceTier;
  /** Number of particles to render */
  particleCount: number;
  /** Number of connection lines to render */
  maxConnections: number;
  /** Whether to enable blur effects */
  enableBlur: boolean;
  /** Blur radius (reduced on lower-end devices) */
  blurRadius: number;
  /** Whether to enable custom shaders */
  enableShaders: boolean;
  /** Particle update frequency (1 = every frame, 2 = every other frame) */
  particleUpdateFrequency: number;
};

// ─── Device Detection ────────────────────────────────────────────────────────

function detectPerformanceTier(): PerformanceTier {
  const { width, height } = Dimensions.get("window");
  const screenArea = width * height;

  // Use screen resolution as a rough proxy for device capability
  // This is a heuristic - in production you'd use device model detection
  if (Platform.OS === "ios") {
    // iPhone 12+ has ~2.5M pixels, older devices less
    if (screenArea > 2_000_000) {
      return "high";
    }
    if (screenArea > 1_000_000) {
      return "medium";
    }
    return "low";
  }

  // Android - be more conservative due to fragmentation
  if (screenArea > 2_500_000) {
    return "high";
  }
  if (screenArea > 1_500_000) {
    return "medium";
  }
  return "low";
}

// ─── Performance Configs ─────────────────────────────────────────────────────

const PERFORMANCE_CONFIGS: Record<PerformanceTier, PerformanceConfig> = {
  high: {
    tier: "high",
    particleCount: 200,
    maxConnections: 30,
    enableBlur: true,
    blurRadius: 20,
    enableShaders: true,
    particleUpdateFrequency: 1,
  },
  medium: {
    tier: "medium",
    particleCount: 100,
    maxConnections: 15,
    enableBlur: true,
    blurRadius: 12,
    enableShaders: true,
    particleUpdateFrequency: 1,
  },
  low: {
    tier: "low",
    particleCount: 50,
    maxConnections: 8,
    enableBlur: false, // Blur is expensive on low-end
    blurRadius: 8,
    enableShaders: true, // Shaders are usually fine, it's particle count that hurts
    particleUpdateFrequency: 2,
  },
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns optimized performance settings for the current device
 */
export function usePerformanceConfig(): PerformanceConfig {
  const config = useMemo(() => {
    const tier = detectPerformanceTier();
    return PERFORMANCE_CONFIGS[tier];
  }, []);

  return config;
}

/**
 * Returns true if the device should use reduced motion settings
 * (respects system accessibility settings)
 */
export function useReducedMotion(): boolean {
  // In a full implementation, this would check:
  // - AccessibilityInfo.isReduceMotionEnabled()
  // - User preferences
  // For now, return false (full motion enabled)
  return false;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Clamp a value to a performance-appropriate range
 */
export function clampForPerformance(
  value: number,
  min: number,
  max: number,
  tier: PerformanceTier
): number {
  const tierMultiplier = { high: 1.0, medium: 0.7, low: 0.4 }[tier];
  const adjusted = value * tierMultiplier;
  return Math.max(min, Math.min(max, adjusted));
}

/**
 * Skip frames for expensive operations on lower-end devices
 */
export function shouldUpdateThisFrame(
  frameCount: number,
  frequency: number
): boolean {
  return frameCount % frequency === 0;
}
