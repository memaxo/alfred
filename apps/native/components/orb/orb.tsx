/**
 * ALFRED Orb Component
 *
 * The neural orb visualization - a living, breathing presence that responds
 * to voice input/output states. Built with Skia for GPU-accelerated rendering.
 */

import { Canvas, Group, useClock, vec } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  ALFRED_COLORS,
  ANIMATION,
  ORB_STATES,
  type OrbState,
} from "./constants";
import { usePerformanceConfig } from "./hooks/use-performance";
import { CoreVoid } from "./layers/core";
import { CoronaRing } from "./layers/corona";
import { GlowLayer } from "./layers/glow";
import { ParticleField } from "./layers/particles";
import { LiquidSurface } from "./layers/surface";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrbProps = {
  /** Current orb state */
  state: OrbState;
  /** Input volume from VAD (0-1) */
  inputVolume?: number;
  /** Output volume from TTS playback (0-1) */
  outputVolume?: number;
  /** Size of the orb canvas */
  size: number;
  /** Whether to show particles */
  showParticles?: boolean;
  /** Optional callback when orb is tapped */
  onPress?: () => void;
  /** Test ID for testing */
  testID?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Orb({
  state,
  inputVolume = 0,
  outputVolume = 0,
  size,
  showParticles = true,
  testID,
}: OrbProps) {
  const clock = useClock();
  const center = useMemo(() => vec(size / 2, size / 2), [size]);
  const radius = useMemo(() => size * 0.35, [size]);

  // Performance-optimized settings based on device capability
  const perfConfig = usePerformanceConfig();

  // ─── Animated Values ─────────────────────────────────────────────────────────

  // Time in seconds for smooth animation
  const time = useDerivedValue(() => clock.value / 1000);

  // Smooth volume transitions
  const smoothInputVolume = useSharedValue(0);
  const smoothOutputVolume = useSharedValue(0);

  useEffect(() => {
    smoothInputVolume.value = withTiming(inputVolume, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  }, [inputVolume, smoothInputVolume]);

  useEffect(() => {
    smoothOutputVolume.value = withTiming(outputVolume, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  }, [outputVolume, smoothOutputVolume]);

  // State-based derived values
  const stateConfig = useMemo(() => ORB_STATES[state], [state]);

  // Animated glow intensity
  const glowIntensity = useSharedValue(stateConfig.glow);
  useEffect(() => {
    glowIntensity.value = withTiming(stateConfig.glow, {
      duration: ANIMATION.colorTransitionDuration,
      easing: Easing.inOut(Easing.quad),
    });
  }, [stateConfig.glow, glowIntensity]);

  // Animated pulse speed
  const pulseSpeed = useSharedValue(stateConfig.pulseSpeed);
  useEffect(() => {
    pulseSpeed.value = withTiming(stateConfig.pulseSpeed, {
      duration: ANIMATION.colorTransitionDuration,
      easing: Easing.inOut(Easing.quad),
    });
  }, [stateConfig.pulseSpeed, pulseSpeed]);

  // Combined volume for effects
  const combinedVolume = useDerivedValue(() =>
    Math.max(smoothInputVolume.value, smoothOutputVolume.value)
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
    >
      <Canvas style={styles.canvas}>
        <Group>
          {/* Layer 1: Particle field (background) */}
          {showParticles && (
            <ParticleField
              center={center}
              maxConnections={perfConfig.maxConnections}
              particleCount={perfConfig.particleCount}
              radius={radius * 1.8}
              state={state}
              time={time}
              volume={combinedVolume}
            />
          )}

          {/* Layer 2: Outer glow (bloom) */}
          <GlowLayer
            center={center}
            color={stateConfig.corona}
            intensity={glowIntensity}
            pulseSpeed={pulseSpeed}
            radius={radius}
            time={time}
          />

          {/* Layer 3: Corona ring */}
          <CoronaRing
            center={center}
            color={stateConfig.corona}
            radius={radius}
            time={time}
            volume={combinedVolume}
          />

          {/* Layer 4: Liquid surface */}
          <LiquidSurface
            center={center}
            radius={radius * 0.95}
            time={time}
            volume={combinedVolume}
          />

          {/* Layer 5: Core void */}
          <CoreVoid center={center} radius={radius * 0.85} />
        </Group>
      </Canvas>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: ALFRED_COLORS.background,
  },
  canvas: {
    flex: 1,
  },
});
