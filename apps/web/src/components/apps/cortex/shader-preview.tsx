"use client";

/**
 * Shader Preview - Live WebGPU shader rendering canvas
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { CortexPreset } from "./index";

type ShaderPreviewProps = {
  preset: CortexPreset | null;
  className?: string;
};

export function ShaderPreview({ preset, className }: ShaderPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      time += 0.016;

      // Mock shader visualization
      const { width, height } = canvas;
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          // Simple shader effect
          const nx = x / width - 0.5;
          const ny = y / height - 0.5;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const wave = Math.sin(dist * 20 - time * 2) * 0.5 + 0.5;

          // Color based on preset category
          if (preset?.category === "orb") {
            data[i] = wave * 34;
            data[i + 1] = wave * 211;
            data[i + 2] = wave * 238;
          } else if (preset?.category === "wallpaper") {
            data[i] = wave * 139;
            data[i + 1] = wave * 92;
            data[i + 2] = wave * 246;
          } else {
            data[i] = wave * 100;
            data[i + 1] = wave * 150;
            data[i + 2] = wave * 200;
          }
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [preset]);

  return (
    <div className={cn("relative h-full w-full bg-void", className)}>
      <canvas
        className="h-full w-full"
        height={400}
        ref={canvasRef}
        width={600}
      />

      {!preset && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-biolum-dim">
            <p className="text-lg">Select a preset to preview</p>
            <p className="mt-1 text-sm">
              WebGPU shaders render here in real-time
            </p>
          </div>
        </div>
      )}

      {preset && (
        <div className="absolute bottom-2 left-2 rounded bg-void/80 px-2 py-1 text-xs backdrop-blur-sm">
          {preset.name} • {preset.category}
        </div>
      )}
    </div>
  );
}
