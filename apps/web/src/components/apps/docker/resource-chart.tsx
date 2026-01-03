"use client";

/**
 * Resource Chart - CPU/Memory/Network graphs
 */

import { cn } from "@/lib/utils";

type ResourceChartProps = {
  containerId: string;
  className?: string;
};

export function ResourceChart({
  containerId: _containerId,
  className,
}: ResourceChartProps) {
  // Mock resource data
  const cpuPercent = 12.5;
  const memoryUsage = 256;
  const memoryLimit = 1024;
  const networkIn = 1.2;
  const networkOut = 0.8;

  return (
    <div className={cn("grid gap-4 p-4", className)}>
      {/* CPU */}
      <ResourceCard
        color="bg-blue-500"
        label="CPU Usage"
        max={100}
        unit="%"
        value={cpuPercent}
      />

      {/* Memory */}
      <ResourceCard
        color="bg-purple-500"
        label="Memory"
        max={memoryLimit}
        unit="MB"
        value={memoryUsage}
      />

      {/* Network */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
        <h3 className="mb-3 font-medium text-sm">Network I/O</h3>
        <div className="flex items-center gap-8">
          <div>
            <span className="font-semibold text-2xl text-green-400">
              {networkIn}
            </span>
            <span className="ml-1 text-biolum-dim text-sm">MB/s in</span>
          </div>
          <div>
            <span className="font-semibold text-2xl text-orange-400">
              {networkOut}
            </span>
            <span className="ml-1 text-biolum-dim text-sm">MB/s out</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({
  label,
  value,
  max,
  unit,
  color,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const percent = (value / max) * 100;

  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium text-sm">{label}</h3>
        <span className="text-biolum">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="mt-1 text-right text-biolum-dim text-xs">
        of {max}
        {unit}
      </div>
    </div>
  );
}
