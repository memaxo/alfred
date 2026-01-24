"use client";

/**
 * Waveform - Voice activity visualization
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useVoiceStore } from "@/store/voice";

type WaveformProps = {
  className?: string;
};

export function Waveform({ className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isListening = useVoiceStore((s) => s.isListening);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const inputLevel = useVoiceStore((s) => s.inputLevel);
  const outputLevel = useVoiceStore((s) => s.outputLevel);

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
    let bars: number[] = new Array(32).fill(0);
    let time = 0;

    const animate = () => {
      time += 0.05;

      // Update bars with some randomness
      bars = bars.map((_, i) => {
        if (isListening || isSpeaking) {
          const level = isListening ? inputLevel : outputLevel;
          const noise = Math.sin(time + i * 0.5) * 0.3 + 0.7;
          return Math.min(1, (level + Math.random() * 0.2) * noise);
        }
        // Idle animation
        return Math.sin(time + i * 0.2) * 0.1 + 0.15;
      });

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bars
      const barWidth = canvas.width / bars.length;
      const barGap = 2;

      bars.forEach((value, i) => {
        const barHeight = value * canvas.height * 0.8;
        const x = i * barWidth + barGap / 2;
        const y = (canvas.height - barHeight) / 2;

        // Color based on state
        if (isListening) {
          ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + value * 0.5})`; // Blue
        } else if (isSpeaking) {
          ctx.fillStyle = `rgba(34, 197, 94, ${0.5 + value * 0.5})`; // Green
        } else {
          ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + value * 0.3})`; // Cyan
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - barGap, barHeight, 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isListening, isSpeaking, inputLevel, outputLevel]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/5",
        className
      )}
    >
      <canvas
        className="h-full w-full"
        height={64}
        ref={canvasRef}
        width={640}
      />
    </div>
  );
}
