"use client";

/**
 * Performance Chart - CPU and memory visualization
 */

import { cn } from "@/lib/utils";

interface PerformanceChartProps {
  className?: string;
}

export function PerformanceChart({ className }: PerformanceChartProps) {
  // Mock data
  const cpuPercent = 44.9;
  const memoryUsed = 1664;
  const memoryTotal = 16_384;

  return (
    <div className={cn("grid gap-4 p-4 md:grid-cols-2", className)}>
      {/* CPU */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
        <h3 className="mb-4 font-medium">CPU Usage</h3>
        <div className="flex items-end gap-4">
          <div className="font-semibold text-4xl text-blue-400">
            {cpuPercent.toFixed(1)}%
          </div>
          <div className="text-biolum-dim text-sm">
            <div>8 cores</div>
            <div>Base: 3.2 GHz</div>
          </div>
        </div>
        {/* Simple bar chart placeholder */}
        <div className="mt-4 flex h-24 items-end gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              className="flex-1 rounded-t bg-blue-500/50"
              key={i}
              style={{ height: `${Math.random() * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Memory */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
        <h3 className="mb-4 font-medium">Memory Usage</h3>
        <div className="flex items-end gap-4">
          <div className="font-semibold text-4xl text-purple-400">
            {(memoryUsed / 1024).toFixed(1)} GB
          </div>
          <div className="text-biolum-dim text-sm">
            <div>of {(memoryTotal / 1024).toFixed(0)} GB</div>
            <div>{((memoryUsed / memoryTotal) * 100).toFixed(0)}% used</div>
          </div>
        </div>
        {/* Memory composition */}
        <div className="mt-4 h-8 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
            style={{ width: `${(memoryUsed / memoryTotal) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-biolum-dim text-xs">
          <span>In use: {memoryUsed}MB</span>
          <span>Available: {memoryTotal - memoryUsed}MB</span>
        </div>
      </div>
    </div>
  );
}
