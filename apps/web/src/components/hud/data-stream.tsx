/**
 * Data Stream Visualization
 *
 * JARVIS-style flowing data visualization showing real-time
 * activity around the central orb.
 *
 * @module hud/data-stream
 */

"use client";

import { motion, useAnimationFrame, useReducedMotion } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface DataStreamProps {
  /** Stream direction */
  direction?: "up" | "down" | "left" | "right";
  /** Number of data particles */
  particleCount?: number;
  /** Animation speed multiplier */
  speed?: number;
  /** Particle color */
  color?: string;
  /** Stream width */
  width?: number;
  /** Stream height */
  height?: number;
  /** Additional className */
  className?: string;
  /** Whether stream is active */
  active?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  char?: string;
}

const DATA_CHARS = [..."01アイウエオカキクケコABCDEF∆∇∂∫≈≠"];

/**
 * Generate random data character
 */
function randomChar(): string {
  return DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)] ?? "0";
}

/**
 * Data stream visualization with flowing particles/characters
 */
export function DataStream({
  direction = "up",
  particleCount = 20,
  speed = 1,
  color = "#00FF88",
  width = 100,
  height = 300,
  className,
  active = true,
}: DataStreamProps) {
  const reduceMotion = useReducedMotion();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const timeRef = React.useRef(0);

  // Initialize particles
  React.useEffect(() => {
    const particles: Particle[] = [];
    const isVertical = direction === "up" || direction === "down";

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        id: i,
        x: isVertical ? Math.random() * width : Math.random() * width,
        y: isVertical ? Math.random() * height : Math.random() * height,
        size: 8 + Math.random() * 4,
        speed: (0.5 + Math.random() * 0.5) * speed,
        opacity: 0.3 + Math.random() * 0.7,
        char: randomChar(),
      });
    }
    particlesRef.current = particles;
  }, [direction, particleCount, speed, width, height]);

  // Animation loop
  useAnimationFrame((time, delta) => {
    if (!active || reduceMotion) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx)) {
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    const particles = particlesRef.current;
    const isVertical = direction === "up" || direction === "down";
    const isReverse = direction === "down" || direction === "right";

    for (const particle of particles) {
      // Move particle
      const movement = particle.speed * (delta / 16) * (isReverse ? 1 : -1);

      if (isVertical) {
        particle.y += movement;
        // Wrap around
        if (particle.y < -20) {
          particle.y = height + 20;
        }
        if (particle.y > height + 20) {
          particle.y = -20;
        }
      } else {
        particle.x += movement;
        if (particle.x < -20) {
          particle.x = width + 20;
        }
        if (particle.x > width + 20) {
          particle.x = -20;
        }
      }

      // Occasionally change character
      if (Math.random() < 0.01) {
        particle.char = randomChar();
      }

      // Calculate fade based on position
      let fade = 1;
      if (isVertical) {
        const center = height / 2;
        const dist = Math.abs(particle.y - center);
        fade = Math.max(0, 1 - dist / center);
      } else {
        const center = width / 2;
        const dist = Math.abs(particle.x - center);
        fade = Math.max(0, 1 - dist / center);
      }

      // Draw particle
      ctx.font = `${particle.size}px "JetBrains Mono", monospace`;
      ctx.fillStyle = color;
      ctx.globalAlpha = particle.opacity * fade;
      ctx.fillText(particle.char ?? "0", particle.x, particle.y);
    }

    ctx.globalAlpha = 1;
    timeRef.current = time;
  });

  return (
    <canvas
      className={cn("pointer-events-none", className)}
      height={height}
      ref={canvasRef}
      style={{ width, height }}
      width={width}
    />
  );
}

/**
 * Horizontal data bar showing activity level
 */
export function DataBar({
  value,
  max = 100,
  label,
  color = "#00FF88",
  showValue = true,
  animated = true,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const animateBar = animated && !reduceMotion;
  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className={cn("space-y-1", className)}>
      {(label || showValue) && (
        <div className="flex justify-between font-mono text-[10px] text-white/60">
          {label && <span className="uppercase tracking-wide">{label}</span>}
          {showValue && (
            <span style={{ color }}>
              {value.toFixed(1)}/{max}
            </span>
          )}
        </div>
      )}
      <div className="relative h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${percentage}%` }}
          className="absolute top-0 left-0 h-full rounded-full"
          initial={{ width: 0 }}
          style={{ backgroundColor: color }}
          transition={
            animateBar ? { duration: 0.5, ease: "easeOut" } : { duration: 0 }
          }
        />
        {/* Glow effect */}
        <motion.div
          animate={{ width: `${percentage}%` }}
          className="absolute top-0 left-0 h-full rounded-full blur-sm"
          initial={{ width: 0 }}
          style={{ backgroundColor: color, opacity: 0.5 }}
          transition={
            animateBar ? { duration: 0.5, ease: "easeOut" } : { duration: 0 }
          }
        />
      </div>
    </div>
  );
}

/**
 * Circular data visualization (arc reactor style)
 */
export function DataRing({
  value,
  max = 100,
  size = 80,
  strokeWidth = 4,
  color = "#00FF88",
  label,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const percentage = Math.min(100, (value / max) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <svg className="-rotate-90" height={size} width={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Value ring */}
        <motion.circle
          animate={{ strokeDashoffset }}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          initial={{ strokeDashoffset: circumference }}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }
          }
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-medium font-mono text-sm" style={{ color }}>
          {Math.round(percentage)}%
        </span>
        {label && (
          <span className="font-mono text-[8px] text-white/50 uppercase tracking-wider">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
