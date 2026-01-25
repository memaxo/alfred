import type { ReactNode } from "react";

export interface TimerPaneItem {
  id: string;
  duration: number; // Total duration in seconds
  label: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface TimerPaneProps {
  items: TimerPaneItem[];
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function calculateElapsed(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function calculateRemaining(duration: number, elapsed: number): number {
  return Math.max(0, duration - elapsed);
}

export function TimerPane({
  items,
  onComplete,
  onCancel,
  className,
}: TimerPaneProps): ReactNode {
  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="py-8 text-center text-biolum-dim">
          No active timers. Create one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}
    >
      {items.map((timer) => {
        const isActive =
          timer.startedAt && !timer.completedAt && !timer.cancelledAt;
        const elapsed =
          isActive && timer.startedAt ? calculateElapsed(timer.startedAt) : 0;
        const remaining = isActive
          ? calculateRemaining(timer.duration, elapsed)
          : timer.duration;
        const progress = isActive ? (elapsed / timer.duration) * 100 : 0;
        const isComplete = remaining === 0;

        return (
          <div
            className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl"
            key={timer.id}
          >
            {/* Label and Duration */}
            <div>
              <h3 className="font-medium text-biolum text-lg tracking-tighter">
                {timer.label || "Timer"}
              </h3>
              <p className="text-biolum-dim text-sm">
                Duration: {formatTime(timer.duration)}
              </p>
            </div>

            {/* Progress Circle */}
            <div className="flex items-center justify-center py-4">
              <div className="relative h-32 w-32">
                {/* Background circle */}
                <svg className="-rotate-90 h-32 w-32 transform">
                  <circle
                    cx="64"
                    cy="64"
                    fill="none"
                    r="56"
                    stroke="oklch(0.14 0 0)"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    className="transition-all duration-1000"
                    cx="64"
                    cy="64"
                    fill="none"
                    r="56"
                    stroke="oklch(0.99 0 0)"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    strokeWidth="8"
                    style={{
                      filter: "drop-shadow(0 0 8px oklch(0.99 0 0 / 0.3))",
                    }}
                  />
                </svg>
                {/* Time display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-2xl text-biolum tracking-tight">
                    {formatTime(remaining)}
                  </span>
                  {isActive && (
                    <span className="text-biolum-dim text-xs">remaining</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            {timer.completedAt && (
              <div className="flex justify-center">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-emerald-400 text-xs">
                  Completed
                </span>
              </div>
            )}
            {timer.cancelledAt && (
              <div className="flex justify-center">
                <span className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-red-400 text-xs">
                  Cancelled
                </span>
              </div>
            )}

            {/* Controls */}
            {isActive && (
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-full bg-biolum px-4 py-2 font-medium text-void transition-colors hover:bg-biolum/90"
                  disabled={!isComplete}
                  onClick={() =>
                    isComplete ? onComplete(timer.id) : onComplete(timer.id)
                  }
                  type="button"
                >
                  {isComplete ? "Complete" : "Mark Complete"}
                </button>
                <button
                  className="rounded-full border border-red-500/30 bg-red-500/20 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/30"
                  onClick={() => onCancel(timer.id)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
