/**
 * Bar Visualizer Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/bar-visualizer
 * Displays audio waveform visualization
 */

import { cn } from "@/lib/utils";

interface VizProps {
  data: number[];
  className?: string;
}

export function Viz({ data, className }: VizProps) {
  return (
    <div className={cn("flex h-12 items-end justify-center gap-1", className)}>
      {data.map((value, index) => (
        <div
          key={index}
          className="w-1 bg-primary transition-all"
          style={{ height: `${value * 100}%` }}
        />
      ))}
    </div>
  );
}

