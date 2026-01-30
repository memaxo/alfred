import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { WaveformProps } from "./types";

import { Waveform } from "./visual";

export type AudioScrubberProps = WaveformProps & {
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  showHandle?: boolean;
};

export const AudioScrubber = ({
  data = [],
  currentTime = 0,
  duration = 100,
  onSeek,
  showHandle = true,
  barWidth = 3,
  barHeight,
  barGap = 1,
  barRadius = 1,
  barColor,
  height = 128,
  className,
  ...props
}: AudioScrubberProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const waveformData =
    data.length > 0
      ? data
      : Array.from({ length: 100 }, () => 0.2 + Math.random() * 0.6);

  useEffect(() => {
    if (!isDragging && duration > 0) {
      setLocalProgress(currentTime / duration);
    }
  }, [currentTime, duration, isDragging]);

  const handleScrub = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const progress = x / rect.width;
      const newTime = progress * duration;

      setLocalProgress(progress);
      onSeek?.(newTime);
    },
    [duration, onSeek]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleScrub(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleScrub]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      aria-label="Audio waveform scrubber"
      aria-valuemax={duration}
      aria-valuemin={0}
      aria-valuenow={currentTime}
      className={cn("relative cursor-pointer select-none", className)}
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role="slider"
      style={{ height: heightStyle }}
      tabIndex={0}
      {...props}
    >
      <Waveform
        barColor={barColor}
        barGap={barGap}
        barHeight={barHeight}
        barRadius={barRadius}
        barWidth={barWidth}
        data={waveformData}
        fadeEdges={false}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-primary/20"
        style={{ width: `${localProgress * 100}%` }}
      />

      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary"
        style={{ left: `${localProgress * 100}%` }}
      />

      {showHandle && (
        <div
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 h-4 w-4 rounded-full border-2 border-background bg-primary shadow-lg transition-transform hover:scale-110"
          style={{ left: `${localProgress * 100}%` }}
        />
      )}
    </div>
  );
};
