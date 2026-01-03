"use client";

/**
 * Accuracy Chart - Accuracy trends over time by category
 */

import { cn } from "@/lib/utils";

type AccuracyChartProps = {
  timeRange: "day" | "week" | "month";
};

const mockData = {
  reasoning: [85, 87, 86, 89, 91, 90, 92],
  coding: [78, 80, 82, 81, 84, 86, 88],
  planning: [90, 89, 91, 92, 91, 93, 94],
  communication: [92, 93, 94, 93, 95, 94, 96],
};

const categoryColors = {
  reasoning: "bg-purple-400",
  coding: "bg-blue-400",
  planning: "bg-orange-400",
  communication: "bg-green-400",
};

export function AccuracyChart({ timeRange: _timeRange }: AccuracyChartProps) {
  const maxValue = 100;

  return (
    <div className="p-4">
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {Object.entries(mockData).map(([category, values]) => {
          const current = values.at(-1) ?? 0;
          const previous = values.at(-2) ?? 0;
          const change = current - previous;

          return (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-3"
              key={category}
            >
              <div className="mb-1 text-biolum-dim text-xs capitalize">
                {category}
              </div>
              <div className="flex items-end gap-2">
                <span className="font-mono text-2xl">{current}%</span>
                <span
                  className={cn(
                    "text-xs",
                    change >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium text-sm">Accuracy Trend</span>
          <span className="text-biolum-dim text-xs">Last 7 days</span>
        </div>

        <div className="space-y-4">
          {Object.entries(mockData).map(([category, values]) => (
            <div key={category}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-biolum-dim capitalize">{category}</span>
                <span>{values.at(-1)}%</span>
              </div>
              <div className="flex h-6 items-end gap-1">
                {values.map((value, idx) => (
                  <div
                    className={cn(
                      "flex-1 rounded-sm transition-all",
                      categoryColors[category as keyof typeof categoryColors]
                    )}
                    key={idx}
                    style={{
                      height: `${(value / maxValue) * 100}%`,
                      opacity: 0.4 + (idx / values.length) * 0.6,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        {Object.entries(categoryColors).map(([category, color]) => (
          <div className="flex items-center gap-1" key={category}>
            <div className={cn("h-2 w-2 rounded-full", color)} />
            <span className="text-biolum-dim text-xs capitalize">
              {category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
