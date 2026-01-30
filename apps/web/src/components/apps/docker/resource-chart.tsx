/**
 * Resource Chart - CPU/Memory/Network graphs
 */

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface ResourceChartProps {
  containerId: string;
  className?: string;
}

export function ResourceChart({ containerId, className }: ResourceChartProps) {
  const { data } = trpc.deploy.containersStats.useQuery(
    { containerId },
    { refetchInterval: 3000 }
  );

  const cpuPercent = data?.cpuPercent ?? 0;
  const memoryUsage = data?.memoryUsage ?? 0;
  const memoryLimit = data?.memoryLimit ?? 0;

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
        max={memoryLimit || 1}
        unit="MB"
        value={memoryUsage}
      />
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
