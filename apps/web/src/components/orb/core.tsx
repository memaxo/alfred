"use client";

/**
 * Orb Core - The visual orb element with state-based animations
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { type OrbState, useOrbStore } from "@/store/orb";

interface OrbCoreProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
};

const stateColors: Record<OrbState, string> = {
  idle: "from-biolum/30 to-biolum/10",
  listening: "from-blue-500/50 to-blue-400/20",
  thinking: "from-purple-500/50 to-purple-400/20",
  talking: "from-green-500/50 to-green-400/20",
  active: "from-biolum/70 to-biolum/30",
};

const stateGlows: Record<OrbState, string> = {
  idle: "shadow-biolum/20",
  listening: "shadow-blue-500/40",
  thinking: "shadow-purple-500/40",
  talking: "shadow-green-500/40",
  active: "shadow-biolum/60",
};

export function OrbCore({ size = "md", className, onClick }: OrbCoreProps) {
  const state = useOrbStore((s) => s.state);
  const intensity = useOrbStore((s) => s.intensity);
  const pulseRate = useOrbStore((s) => s.pulseRate);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation loop for custom rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationId: number;
    let time = 0;

    const animate = () => {
      time += 0.016 * pulseRate;
      const pulse = (Math.sin(time * Math.PI * 2) + 1) / 2;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw orb
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = (canvas.width / 2 - 4) * (0.8 + pulse * 0.2 * intensity);

      // Glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.5
      );
      gradient.addColorStop(0, `rgba(34, 211, 238, ${0.6 * intensity})`);
      gradient.addColorStop(
        0.5,
        `rgba(34, 211, 238, ${0.3 * intensity * pulse})`
      );
      gradient.addColorStop(1, "rgba(34, 211, 238, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreGradient = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        0,
        centerX,
        centerY,
        radius
      );
      coreGradient.addColorStop(0, `rgba(34, 211, 238, ${0.9 * intensity})`);
      coreGradient.addColorStop(0.7, `rgba(34, 211, 238, ${0.5 * intensity})`);
      coreGradient.addColorStop(1, `rgba(34, 211, 238, ${0.2 * intensity})`);

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [intensity, pulseRate, state]);

  return (
    <button
      className={cn(
        "relative rounded-full transition-all duration-300",
        sizes[size],
        className
      )}
      onClick={onClick}
      type="button"
    >
      {/* Canvas for custom rendering */}
      <canvas
        className="absolute inset-0 h-full w-full"
        height={size === "lg" ? 80 : (size === "md" ? 48 : 32)}
        ref={canvasRef}
        width={size === "lg" ? 80 : (size === "md" ? 48 : 32)}
      />

      {/* Fallback gradient */}
      <div
        className={cn(
          "absolute inset-1 rounded-full bg-gradient-to-br transition-all duration-300",
          stateColors[state],
          "shadow-lg",
          stateGlows[state]
        )}
        style={{
          opacity: 0.3, // Fallback shown behind canvas
        }}
      />
    </button>
  );
}
