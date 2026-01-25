/**
 * ParticleField Layer
 *
 * Neural particle system that creates the living, breathing field around the orb.
 * Particles are drawn toward the center when listening, pushed outward when speaking,
 * and orbit gently when idle.
 */

import type { SharedValue } from "react-native-reanimated";

import {
  Circle,
  Group,
  Line,
  type SkPoint,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";

import { ANIMATION, ORB_STATES, type OrbState } from "../constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParticleFieldProps {
  /** Center point of the field */
  center: SkPoint;
  /** Outer radius of the particle field */
  radius: number;
  /** Animation time */
  time: SharedValue<number>;
  /** Current orb state */
  state: OrbState;
  /** Voice volume for reactivity (0-1) */
  volume: SharedValue<number>;
  /** Number of particles */
  particleCount: number;
  /** Maximum number of connection lines (for performance) */
  maxConnections?: number;
}

interface Particle {
  id: number;
  baseAngle: number;
  baseRadius: number;
  size: number;
  speed: number;
  phase: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49_297) % 233_280;
    return s / 233_280;
  };
}

function createParticles(count: number, _radius: number): Particle[] {
  const random = seededRandom(42);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      baseAngle: random() * Math.PI * 2,
      baseRadius: 0.4 + random() * 0.6, // 40-100% of radius
      size: 1 + random() * 2,
      speed: 0.2 + random() * 0.8,
      phase: random() * Math.PI * 2,
    });
  }

  return particles;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ParticleField({
  center,
  radius,
  time,
  state,
  volume,
  particleCount,
  maxConnections = 30,
}: ParticleFieldProps) {
  // Create stable particle array
  const particles = useMemo(
    () => createParticles(particleCount, radius),
    [particleCount, radius]
  );

  const stateConfig = ORB_STATES[state];
  const { particleDirection } = stateConfig;

  // Calculate particle positions based on time and state
  const particlePositions = useDerivedValue(() => {
    const t = time.value;
    const vol = volume.value;
    const positions: { x: number; y: number; alpha: number; size: number }[] =
      [];

    for (const particle of particles) {
      let angle = particle.baseAngle;
      let r = particle.baseRadius * radius;

      // Apply state-based movement
      switch (particleDirection) {
        case "inward": {
          // Particles drift toward center
          r *= 0.7 + 0.3 * (1 - vol);
          angle += t * particle.speed * 0.3;
          break;
        }

        case "outward": {
          // Particles push outward
          r *= 1 + vol * 0.3;
          angle += t * particle.speed * 0.5;
          break;
        }

        case "orbital": {
          // Gentle orbital motion
          angle += t * particle.speed * 0.2;
          r += Math.sin(t * particle.speed + particle.phase) * 10;
          break;
        }

        case "scatter": {
          // Chaotic scatter
          angle += Math.sin(t * 3 + particle.phase) * 0.5;
          r += Math.sin(t * 5 + particle.phase) * 20;
          break;
        }
        default: {
          // Minimal drift
          angle += t * particle.speed * 0.05;
          break;
        }
      }

      // Convert polar to cartesian
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;

      // Distance-based alpha (fade at edges)
      const distFromCenter = Math.sqrt(
        (x - center.x) ** 2 + (y - center.y) ** 2
      );
      const normalizedDist = distFromCenter / radius;
      const alpha = Math.max(0, Math.min(1, 1 - normalizedDist * 0.5)) * 0.6;

      positions.push({
        x,
        y,
        alpha,
        size: particle.size * (1 + vol * 0.5),
      });
    }

    return positions;
  });

  // Find nearby particles for connection lines
  const connections = useDerivedValue(() => {
    const positions = particlePositions.value;
    const lines: { p1: SkPoint; p2: SkPoint; alpha: number }[] = [];
    const threshold = ANIMATION.connectionDistance;

    // Only check subset for performance (adaptive based on maxConnections)
    const checkCount = Math.min(positions.length, maxConnections * 2);

    for (let i = 0; i < checkCount && lines.length < maxConnections; i++) {
      for (
        let j = i + 1;
        j < checkCount && lines.length < maxConnections;
        j++
      ) {
        const p1 = positions[i];
        const p2 = positions[j];
        const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

        if (dist < threshold) {
          const alpha = (1 - dist / threshold) * ANIMATION.connectionOpacity;
          lines.push({
            p1: vec(p1.x, p1.y),
            p2: vec(p2.x, p2.y),
            alpha: alpha * Math.min(p1.alpha, p2.alpha),
          });
        }
      }
    }

    return lines;
  });

  // Get particle color based on state
  const particleColor = stateConfig.corona;

  return (
    <Group blendMode="plus">
      {/* Connection lines */}
      <ConnectionLines
        color={particleColor}
        connections={connections}
        maxLines={maxConnections}
      />

      {/* Particles */}
      <ParticlePoints
        color={particleColor}
        maxParticles={Math.min(particleCount, 100)}
        positions={particlePositions}
      />
    </Group>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConnectionLines({
  connections,
  color,
  maxLines,
}: {
  connections: SharedValue<{ p1: SkPoint; p2: SkPoint; alpha: number }[]>;
  color: string;
  maxLines: number;
}) {
  // Render a subset of connections for performance
  const linesToRender = useDerivedValue(() =>
    connections.value.slice(0, maxLines)
  );

  return (
    <Group>
      {/* We'll use a simple approach - render static lines that update */}
      {Array.from({ length: maxLines }).map((_, i) => (
        <ConnectionLine
          color={color}
          connections={linesToRender}
          index={i}
          key={i}
        />
      ))}
    </Group>
  );
}

function ConnectionLine({
  index,
  connections,
  color,
}: {
  index: number;
  connections: SharedValue<{ p1: SkPoint; p2: SkPoint; alpha: number }[]>;
  color: string;
}) {
  const lineProps = useDerivedValue(() => {
    const conn = connections.value[index];
    if (!conn) {
      return { p1: vec(0, 0), p2: vec(0, 0), opacity: 0 };
    }
    return {
      p1: conn.p1,
      p2: conn.p2,
      opacity: conn.alpha,
    };
  });

  const p1 = useDerivedValue(() => lineProps.value.p1);
  const p2 = useDerivedValue(() => lineProps.value.p2);
  const opacity = useDerivedValue(() => lineProps.value.opacity);

  return (
    <Line color={color} opacity={opacity} p1={p1} p2={p2} strokeWidth={0.5} />
  );
}

function ParticlePoints({
  positions,
  color,
  maxParticles,
}: {
  positions: SharedValue<
    { x: number; y: number; alpha: number; size: number }[]
  >;
  color: string;
  maxParticles: number;
}) {
  // Render particles individually (for now - can optimize with Atlas later)
  return (
    <Group>
      {Array.from({ length: maxParticles }).map((_, i) => (
        <ParticlePoint color={color} index={i} key={i} positions={positions} />
      ))}
    </Group>
  );
}

function ParticlePoint({
  index,
  positions,
  color,
}: {
  index: number;
  positions: SharedValue<
    { x: number; y: number; alpha: number; size: number }[]
  >;
  color: string;
}) {
  const cx = useDerivedValue(() => positions.value[index]?.x ?? 0);
  const cy = useDerivedValue(() => positions.value[index]?.y ?? 0);
  const r = useDerivedValue(() => positions.value[index]?.size ?? 1);
  const opacity = useDerivedValue(() => positions.value[index]?.alpha ?? 0);

  return <Circle color={color} cx={cx} cy={cy} opacity={opacity} r={r} />;
}
