/**
 * GlowLayer
 *
 * The outer bloom/glow effect that gives the orb its ethereal presence.
 * Breathes with a subtle pulse and intensifies with state changes.
 */

import {
  Blur,
  Circle,
  Group,
  Paint,
  RadialGradient,
  type SkPoint,
} from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { ANIMATION, hexToRgba } from "../constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type GlowLayerProps = {
  /** Center point of the glow */
  center: SkPoint;
  /** Base radius of the orb (glow extends beyond this) */
  radius: number;
  /** Glow color (hex) */
  color: string;
  /** Glow intensity (0-1) */
  intensity: SharedValue<number>;
  /** Animation time */
  time: SharedValue<number>;
  /** Pulse speed multiplier */
  pulseSpeed: SharedValue<number>;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function GlowLayer({
  center,
  radius,
  color,
  intensity,
  time,
  pulseSpeed,
}: GlowLayerProps) {
  // Animated glow radius with breathing pulse
  const glowRadius = useDerivedValue(() => {
    const breathe = Math.sin(time.value * pulseSpeed.value * 0.5) * 0.5 + 0.5;
    const baseScale = 1.3 + intensity.value * 0.3;
    const pulseScale = 1 + breathe * 0.08;
    return radius * baseScale * pulseScale;
  });

  // Animated opacity
  const glowOpacity = useDerivedValue(() => {
    const breathe = Math.sin(time.value * pulseSpeed.value * 0.5) * 0.5 + 0.5;
    return intensity.value * (0.3 + breathe * 0.2);
  });

  // Convert color to RGBA
  const [r, g, b] = hexToRgba(color);
  const colorWithAlpha = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, `;

  // Gradient colors with animated opacity
  const gradientColors = useDerivedValue(() => {
    const opacity = glowOpacity.value;
    return [
      `${colorWithAlpha}${(opacity * 0.6).toFixed(2)})`,
      `${colorWithAlpha}${(opacity * 0.3).toFixed(2)})`,
      `${colorWithAlpha}0.0)`,
    ];
  });

  return (
    <Group
      layer={
        <Paint>
          <Blur blur={ANIMATION.glowBlurRadius} />
        </Paint>
      }
    >
      <Circle cx={center.x} cy={center.y} r={glowRadius}>
        <RadialGradient
          c={center}
          colors={gradientColors}
          positions={[0, 0.5, 1]}
          r={glowRadius}
        />
      </Circle>
    </Group>
  );
}
