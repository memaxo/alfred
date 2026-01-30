/**
 * Wave Timeline - Execution phase visualization
 */

import { cn } from "@/lib/utils";

interface Wave {
  id: number;
  status: "pending" | "running" | "completed";
  agents: string[];
  startTime?: string;
  endTime?: string;
}

interface WaveTimelineProps {
  waves: Wave[];
  className?: string;
}

export function WaveTimeline({ waves, className }: WaveTimelineProps) {
  return (
    <div className={cn("border-white/5 border-b px-4 py-3", className)}>
      <div className="flex items-center gap-2">
        {waves.map((wave, index) => (
          <div className="flex items-center" key={wave.id}>
            {/* Wave indicator */}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm",
                wave.status === "completed" && "bg-green-500/20 text-green-400",
                wave.status === "running" &&
                  "animate-pulse bg-biolum/20 text-biolum",
                wave.status === "pending" && "bg-white/5 text-biolum-dim"
              )}
            >
              {wave.id}
            </div>

            {/* Connector */}
            {index < waves.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-12",
                  wave.status === "completed"
                    ? "bg-green-500/50"
                    : "bg-white/10"
                )}
              />
            )}
          </div>
        ))}

        {/* Wave info */}
        <div className="ml-4 flex-1">
          {waves.map((wave) =>
            wave.status === "running" ? (
              <div className="text-biolum text-sm" key={wave.id}>
                <span className="font-medium">Wave {wave.id}</span>
                <span className="ml-2 text-biolum-dim">
                  {wave.agents.length} agent{wave.agents.length > 1 ? "s" : ""}{" "}
                  running
                </span>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
