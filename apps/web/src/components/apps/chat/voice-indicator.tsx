/**
 * Voice Indicator - Voice activity visualization
 */

import { Mic, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface VoiceIndicatorProps {
  isActive: boolean;
  status: "idle" | "streaming" | "error";
  className?: string;
}

export function VoiceIndicator({
  isActive,
  status,
  className,
}: VoiceIndicatorProps) {
  if (!isActive && status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-2 py-1",
        isActive ? "bg-red-500/10" : "bg-biolum/10",
        className
      )}
    >
      {isActive ? (
        <>
          <Mic className="h-3 w-3 animate-pulse text-red-400" />
          <span className="text-red-400 text-xs">Listening</span>
          {/* Waveform visualization placeholder */}
          <div className="flex h-3 items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="w-0.5 animate-pulse rounded-full bg-red-400"
                key={i}
                style={{
                  height: `${Math.random() * 12 + 4}px`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </>
      ) : status === "streaming" ? (
        <>
          <Volume2 className="h-3 w-3 animate-pulse text-biolum" />
          <span className="text-biolum text-xs">Speaking</span>
        </>
      ) : null}
    </div>
  );
}
