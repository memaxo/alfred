/**
 * Accuracy Chart - Accuracy trends over time by category
 */

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface AccuracyChartProps {
  timeRange: "day" | "week" | "month";
}

const categoryColors: Record<string, string> = {
  reasoning: "bg-purple-400",
  coding: "bg-blue-400",
  planning: "bg-orange-400",
  communication: "bg-green-400",
  uncategorized: "bg-gray-400",
};

const trendIcons: Record<string, string> = {
  improving: "↑",
  declining: "↓",
  stable: "→",
};

const trendColors: Record<string, string> = {
  improving: "text-green-400",
  declining: "text-red-400",
  stable: "text-yellow-400",
};

export function AccuracyChart({ timeRange: _timeRange }: AccuracyChartProps) {
  const { data, isLoading, error } = trpc.cognitive.metricsAccuracy.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Failed to load accuracy metrics
      </div>
    );
  }

  const metrics = data?.metrics ?? [];

  if (metrics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        No accuracy data available yet
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.slice(0, 4).map((metric) => {
          // Convert error rate to accuracy percentage
          const accuracy = Math.round((1 - metric.errorRate) * 100);

          return (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-3"
              key={metric.category}
            >
              <div className="mb-1 text-biolum-dim text-xs capitalize">
                {metric.category}
              </div>
              <div className="flex items-end gap-2">
                <span className="font-mono text-2xl">{accuracy}%</span>
                <span className={cn("text-xs", trendColors[metric.trend])}>
                  {trendIcons[metric.trend]} {metric.trend}
                </span>
              </div>
              <div className="mt-1 text-biolum-dim text-xs">
                {metric.total} errors tracked
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium text-sm">
            Error Distribution by Category
          </span>
        </div>

        <div className="space-y-4">
          {metrics.map((metric) => {
            const accuracy = Math.round((1 - metric.errorRate) * 100);
            const color =
              categoryColors[metric.category] ?? categoryColors.uncategorized;

            return (
              <div key={metric.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-biolum-dim capitalize">
                    {metric.category}
                  </span>
                  <span>{accuracy}% accuracy</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        {metrics.map((metric) => {
          const color =
            categoryColors[metric.category] ?? categoryColors.uncategorized;
          return (
            <div className="flex items-center gap-1" key={metric.category}>
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <span className="text-biolum-dim text-xs capitalize">
                {metric.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
