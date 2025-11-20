import type { ReactNode } from "react";

export type TimerPaneItem = {
  id: string;
  duration: number; // Total duration in seconds
  label: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type TimerPaneProps = {
  items: TimerPaneItem[];
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  className?: string;
};

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
        <p className="text-biolum-dim text-center py-8">
          No active timers. Create one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
      {items.map((timer) => {
        const isActive = timer.startedAt && !timer.completedAt && !timer.cancelledAt;
        const elapsed = isActive && timer.startedAt ? calculateElapsed(timer.startedAt) : 0;
        const remaining = isActive ? calculateRemaining(timer.duration, elapsed) : timer.duration;
        const progress = isActive ? (elapsed / timer.duration) * 100 : 0;
        const isComplete = remaining === 0;

        return (
          <div
            key={timer.id}
            className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 flex flex-col gap-4"
          >
            {/* Label and Duration */}
            <div>
              <h3 className="text-biolum tracking-tighter text-lg font-medium">
                {timer.label || "Timer"}
              </h3>
              <p className="text-biolum-dim text-sm">
                Duration: {formatTime(timer.duration)}
              </p>
            </div>

            {/* Progress Circle */}
            <div className="flex items-center justify-center py-4">
              <div className="relative w-32 h-32">
                {/* Background circle */}
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="oklch(0.14 0 0)"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="oklch(0.99 0 0)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    className="transition-all duration-1000"
                    style={{
                      filter: "drop-shadow(0 0 8px oklch(0.99 0 0 / 0.3))",
                    }}
                  />
                </svg>
                {/* Time display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-biolum text-2xl font-mono tracking-tight">
                    {formatTime(remaining)}
                  </span>
                  {isActive && (
                    <span className="text-biolum-dim text-xs">
                      remaining
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            {timer.completedAt && (
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Completed
                </span>
              </div>
            )}
            {timer.cancelledAt && (
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                  Cancelled
                </span>
              </div>
            )}

            {/* Controls */}
            {isActive && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => isComplete ? onComplete(timer.id) : onComplete(timer.id)}
                  className="flex-1 px-4 py-2 rounded-full bg-biolum text-void font-medium hover:bg-biolum/90 transition-colors"
                  disabled={!isComplete}
                >
                  {isComplete ? "Complete" : "Mark Complete"}
                </button>
                <button
                  type="button"
                  onClick={() => onCancel(timer.id)}
                  className="px-4 py-2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
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

