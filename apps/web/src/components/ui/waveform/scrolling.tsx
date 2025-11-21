"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { WaveformProps } from "./types";

export type ScrollingWaveformProps = Omit<
  WaveformProps,
  "data" | "onBarClick"
> & {
  speed?: number;
  barCount?: number;
  data?: number[];
};

export const ScrollingWaveform = ({
  speed = 50,
  barCount = 60,
  barWidth = 4,
  barHeight: baseBarHeight = 4,
  barGap = 2,
  barRadius = 2,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  height = 128,
  data,
  className,
  ...props
}: ScrollingWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<Array<{ x: number; height: number }>>([]);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const seedRef = useRef(Math.random());
  const dataIndexRef = useRef(0);
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!(canvas && container)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      if (barsRef.current.length === 0) {
        const step = barWidth + barGap;
        let currentX = rect.width;
        let index = 0;
        const seededRandom = (i: number) => {
          const x = Math.sin(seedRef.current * 10_000 + i) * 10_000;
          return x - Math.floor(x);
        };
        while (currentX > -step) {
          barsRef.current.push({
            x: currentX,
            height: 0.2 + seededRandom(index++) * 0.6,
          });
          currentX -= step;
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [barWidth, barGap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const animate = (currentTime: number) => {
      const deltaTime = lastTimeRef.current
        ? (currentTime - lastTimeRef.current) / 1000
        : 0;
      lastTimeRef.current = currentTime;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor ||
        getComputedStyle(canvas).getPropertyValue("--foreground") ||
        "#000";

      const step = barWidth + barGap;
      for (let i = 0; i < barsRef.current.length; i++) {
        const bar = barsRef.current[i];
        if (bar) {
          bar.x -= speed * deltaTime;
        }
      }

      barsRef.current = barsRef.current.filter(
        (bar) => bar.x + barWidth > -step
      );

      while (
        barsRef.current.length === 0 ||
        (barsRef.current.at(-1)?.x ?? Number.NEGATIVE_INFINITY) < rect.width
      ) {
        const lastBar = barsRef.current.at(-1);
        const nextX = lastBar ? lastBar.x + step : rect.width;

        let newHeight: number;
        if (data && data.length > 0) {
          newHeight = data[dataIndexRef.current % data.length] || 0.1;
          dataIndexRef.current = (dataIndexRef.current + 1) % data.length;
        } else {
          const time = Date.now() / 1000;
          const uniqueIndex = barsRef.current.length + time * 0.01;
          const seededRandom = (index: number) => {
            const x =
              Math.sin(seedRef.current * 10_000 + index * 137.5) * 10_000;
            return x - Math.floor(x);
          };
          const wave1 = Math.sin(uniqueIndex * 0.1) * 0.2;
          const wave2 = Math.cos(uniqueIndex * 0.05) * 0.15;
          const randomComponent = seededRandom(uniqueIndex) * 0.4;
          newHeight = Math.max(
            0.1,
            Math.min(0.9, 0.3 + wave1 + wave2 + randomComponent)
          );
        }

        barsRef.current.push({
          x: nextX,
          height: newHeight,
        });
        if (barsRef.current.length > barCount * 2) {
          break;
        }
      }

      const centerY = rect.height / 2;
      for (const bar of barsRef.current) {
        if (bar.x < rect.width && bar.x + barWidth > 0) {
          const barHeight = Math.max(
            baseBarHeight,
            bar.height * rect.height * 0.6
          );
          const y = centerY - barHeight / 2;

          ctx.fillStyle = computedBarColor;
          ctx.globalAlpha = 0.3 + bar.height * 0.7;

          if (barRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(bar.x, y, barWidth, barHeight, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(bar.x, y, barWidth, barHeight);
          }
        }
      }

      if (fadeEdges && fadeWidth > 0) {
        const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
        const fadePercent = Math.min(0.2, fadeWidth / rect.width);

        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1, "rgba(255,255,255,1)");

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    speed,
    barCount,
    barWidth,
    baseBarHeight,
    barGap,
    barRadius,
    barColor,
    fadeEdges,
    fadeWidth,
    data,
  ]);

  return (
    <div
      className={cn("relative flex items-center", className)}
      ref={containerRef}
      style={{ height: heightStyle }}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
};
