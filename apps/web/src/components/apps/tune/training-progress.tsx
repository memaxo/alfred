"use client";

/**
 * Training Progress - Training progress charts
 */

type TrainingProgressProps = {
  jobId: string | null;
};

// Mock training data
const mockLossData = [2.1, 1.8, 1.5, 1.2, 0.95, 0.78, 0.65, 0.55, 0.48, 0.42];
const mockAccuracyData = [
  0.45, 0.52, 0.58, 0.65, 0.72, 0.78, 0.82, 0.85, 0.86, 0.87,
];

export function TrainingProgress({ jobId }: TrainingProgressProps) {
  if (!jobId) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        Select a job to view training progress
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Loss Chart */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium">Training Loss</span>
          <span className="text-biolum text-sm">
            Current: {mockLossData.at(-1)?.toFixed(2)}
          </span>
        </div>
        <div className="flex h-32 items-end gap-1">
          {mockLossData.map((value, idx) => (
            <div
              className="flex-1 rounded-t bg-red-500/60 transition-all hover:bg-red-500"
              key={idx}
              style={{ height: `${(value / 2.5) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-biolum-dim text-xs">
          <span>Epoch 1</span>
          <span>Epoch {mockLossData.length}</span>
        </div>
      </div>

      {/* Accuracy Chart */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium">Accuracy</span>
          <span className="text-biolum text-sm">
            Current: {((mockAccuracyData.at(-1) ?? 0) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex h-32 items-end gap-1">
          {mockAccuracyData.map((value, idx) => (
            <div
              className="flex-1 rounded-t bg-green-500/60 transition-all hover:bg-green-500"
              key={idx}
              style={{ height: `${value * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-biolum-dim text-xs">
          <span>Epoch 1</span>
          <span>Epoch {mockAccuracyData.length}</span>
        </div>
      </div>

      {/* Training Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Learning Rate", value: "2e-5" },
          { label: "Batch Size", value: "16" },
          { label: "Epochs", value: "10/20" },
          { label: "GPU Memory", value: "14.2 GB" },
        ].map((stat) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3 text-center"
            key={stat.label}
          >
            <div className="font-mono text-lg">{stat.value}</div>
            <div className="text-biolum-dim text-xs">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
