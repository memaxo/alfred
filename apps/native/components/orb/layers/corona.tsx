/**
 * CoronaRing Layer
 *
 * The glowing edge of the orb - like the corona of a black sun.
 * Uses noise displacement for organic, living movement.
 */

import type { SharedValue } from "react-native-reanimated";

import {
  BlurMask,
  Circle,
  Fill,
  Group,
  Shader,
  Skia,
  type SkPoint,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";

import { ANIMATION, hexToRgba } from "../constants";
import { SIMPLEX_NOISE_2D } from "../shaders/noise";

// ─── Types ───────────────────────────────────────────────────────────────────

type CoronaRingProps = {
  /** Center point of the ring */
  center: SkPoint;
  /** Base radius of the ring */
  radius: number;
  /** Corona color (hex) */
  color: string;
  /** Voice volume for reactivity (0-1) */
  volume: SharedValue<number>;
  /** Animation time */
  time: SharedValue<number>;
};

// ─── Shader Source ───────────────────────────────────────────────────────────

const CORONA_SHADER_GLSL = /* glsl */ `
uniform float2 center;
uniform float radius;
uniform float innerRadius;
uniform float time;
uniform float volume;
uniform float4 color;

${SIMPLEX_NOISE_2D}

half4 main(float2 pos) {
  // Distance from center
  float dist = length(pos - center);
  
  // Angle for polar coordinates
  float angle = atan(pos.y - center.y, pos.x - center.x);
  
  // Noise displacement based on angle and time
  float noiseScale = ${ANIMATION.coronaNoiseScale.toFixed(1)};
  float noiseSpeed = ${ANIMATION.coronaNoiseSpeed.toFixed(2)};
  float noise = snoise(vec2(angle * noiseScale, time * noiseSpeed)) * 0.5 + 0.5;
  
  // Volume-reactive displacement
  float displacement = noise * (0.05 + volume * 0.15) * radius;
  
  // Calculate ring with displaced edges
  float outerEdge = radius + displacement;
  float innerEdge = innerRadius - displacement * 0.5;
  
  // Soft ring mask
  float ringMask = smoothstep(innerEdge - 2.0, innerEdge, dist) *
                   smoothstep(outerEdge + 2.0, outerEdge, dist);
  
  // Add inner glow that intensifies with volume
  float innerGlow = smoothstep(innerEdge + 10.0, innerEdge, dist) * (0.3 + volume * 0.4);
  
  // Combine
  float alpha = ringMask + innerGlow * ringMask;
  
  // Color with alpha
  return half4(color.rgb, alpha * color.a);
}
`;

/** Hook to create shader lazily (after Skia is initialized) */
function useCoronaShader() {
  return useMemo(() => {
    try {
      return Skia.RuntimeEffect.Make(CORONA_SHADER_GLSL);
    } catch {
      return null;
    }
  }, []);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CoronaRing({
  center,
  radius,
  color,
  volume,
  time,
}: CoronaRingProps) {
  // Create shader lazily (after Skia is initialized)
  const coronaShaderSource = useCoronaShader();

  // Convert color to RGBA for shader
  const colorRgba = hexToRgba(color, 1.0);

  // Animated uniforms
  const uniforms = useDerivedValue(() => ({
    center: [center.x, center.y] as [number, number],
    radius,
    innerRadius: radius * (1 - ANIMATION.coronaWidth),
    time: time.value,
    volume: volume.value,
    color: colorRgba,
  }));

  if (!coronaShaderSource) {
    // Fallback to simple circle if shader compilation fails
    return (
      <Circle
        color={color}
        cx={center.x}
        cy={center.y}
        opacity={0.6}
        r={radius}
      >
        <BlurMask blur={8} style="normal" />
      </Circle>
    );
  }

  return (
    <Group>
      <Fill>
        <Shader source={coronaShaderSource} uniforms={uniforms} />
      </Fill>
    </Group>
  );
}
