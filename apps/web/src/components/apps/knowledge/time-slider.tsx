/**
 * Time Slider - Temporal navigation for knowledge graph
 */

import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

interface TimeSliderProps {
  value: [Date, Date];
  onChange: (range: [Date, Date]) => void;
  className?: string;
}

export function TimeSlider({
  value,
  onChange: _onChange,
  className,
}: TimeSliderProps) {
  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Calendar className="h-4 w-4 text-biolum-dim" />
      <div className="flex-1">
        <div className="relative h-2 rounded-full bg-white/10">
          <div
            className="absolute h-full rounded-full bg-biolum/50"
            style={{ left: "0%", width: "100%" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-biolum-dim text-xs">
        <span>{formatDate(value[0])}</span>
        <span>→</span>
        <span>{formatDate(value[1])}</span>
      </div>
    </div>
  );
}
