/**
 * LiquidSurface Layer
 *
 * The liquid glass membrane of the orb - a semi-transparent surface
 * with noise-driven distortion that responds to voice input.
 */

import type { SharedValue } from "react-native-reanimated";

import {
  Circle,
  Fill,
  Group,
  RadialGradient,
  Shader,
  Skia,
  type SkPoint,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";

import { ALFRED_COLORS } from "../constants";
import { SIMPLEX_NOISE_2D } from "../shaders/noise";

// ─── Types ───────────────────────────────────────────────────────────────────

type LiquidSurfaceProps = {
  /** Center point of the surface */
  center: SkPoint;
  /** Radius of the surface */
  radius: number;
  /** Voice volume for reactivity (0-1) */
  volume: SharedValue<number>;
  /** Animation time */
  time: SharedValue<number>;
};

// ─── Shader Source ───────────────────────────────────────────────────────────

const LIQUID_SHADER_GLSL = /* glsl */ `
uniform float2 center;
uniform float radius;
uniform float time;
uniform float volume;

${SIMPLEX_NOISE_2D}

half4 main(float2 pos) {
  // Distance and normalized distance from center
  float dist = length(pos - center);
  float normDist = dist / radius;
  
  // Outside the circle - transparent
  if (normDist > 1.0) {
    return half4(0.0, 0.0, 0.0, 0.0);
  }
  
  // UV for noise sampling (polar-ish coordinates)
  float angle = atan(pos.y - center.y, pos.x - center.x);
  vec2 noiseUV = vec2(angle * 0.5, normDist + time * 0.1);
  
  // Layered noise for liquid effect
  float noise1 = snoise(noiseUV * 3.0 + time * 0.2) * 0.5 + 0.5;
  float noise2 = snoise(noiseUV * 6.0 - time * 0.15) * 0.5 + 0.5;
  float combinedNoise = noise1 * 0.7 + noise2 * 0.3;
  
  // Volume-reactive ripples
  float ripple = sin(normDist * 20.0 - time * 4.0 * (1.0 + volume * 2.0)) * 0.5 + 0.5;
  ripple *= (1.0 - normDist) * volume * 0.5;
  
  // Fresnel effect - brighter at edges
  float fresnel = pow(normDist, 2.0);
  
  // Base surface color - very dark with subtle variation
  float surfaceValue = 0.02 + combinedNoise * 0.03 + ripple * 0.05;
  
  // Edge highlight (the liquid glass edge)
  float edgeGlow = smoothstep(0.7, 1.0, normDist) * 0.15;
  
  // Combine for final color
  float luminance = surfaceValue + edgeGlow + fresnel * 0.05;
  
  // Alpha fades at edge for smooth blending
  float alpha = smoothstep(1.0, 0.9, normDist);
  
  // Slightly tinted toward the surface color
  vec3 surfaceColor = vec3(0.08, 0.1, 0.12); // Matches ALFRED surface color
  vec3 finalColor = mix(vec3(0.0), surfaceColor, luminance);
  
  return half4(finalColor, alpha * 0.9);
}
`;

/** Hook to create shader lazily (after Skia is initialized) */
function useLiquidShader() {
  return useMemo(() => {
    try {
      return Skia.RuntimeEffect.Make(LIQUID_SHADER_GLSL);
    } catch {
      return null;
    }
  }, []);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LiquidSurface({
  center,
  radius,
  volume,
  time,
}: LiquidSurfaceProps) {
  // Create shader lazily (after Skia is initialized)
  const liquidShaderSource = useLiquidShader();

  // Animated uniforms
  const uniforms = useDerivedValue(() => ({
    center: [center.x, center.y] as [number, number],
    radius,
    time: time.value,
    volume: volume.value,
  }));

  if (!liquidShaderSource) {
    // Fallback to simple gradient if shader fails
    return (
      <Circle cx={center.x} cy={center.y} r={radius}>
        <RadialGradient
          c={center}
          colors={[
            ALFRED_COLORS.surface,
            `${ALFRED_COLORS.surface}80`,
            `${ALFRED_COLORS.surface}00`,
          ]}
          positions={[0, 0.7, 1]}
          r={radius}
        />
      </Circle>
    );
  }

  return (
    <Group>
      <Fill>
        <Shader source={liquidShaderSource} uniforms={uniforms} />
      </Fill>
    </Group>
  );
}
