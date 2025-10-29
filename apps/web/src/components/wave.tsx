/**
 * Live Waveform Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/live-waveform
 * Real-time audio waveform visualization
 */

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface WaveProps {
  isActive: boolean;
  data?: number[];
  className?: string;
}

export function Wave({ isActive, data, className }: WaveProps) {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setBars([]);
      return;
    }

    const interval = setInterval(() => {
      // Generate random waveform data for demo
      const newBars = Array.from({ length: 20 }, () => Math.random());
      setBars(newBars);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const displayData = data || bars;

  return (
    <div className={cn("flex h-12 items-end justify-center gap-1", className)}>
      {displayData.map((value, index) => (
        <div
          key={index}
          className="w-1 bg-primary transition-all"
          style={{ height: `${value * 100}%` }}
        />
      ))}
    </div>
  );
}

