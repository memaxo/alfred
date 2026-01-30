/**
 * Metric Explorer - Browse available metrics
 */

import {
  Activity,
  BarChart,
  Clock,
  Gauge,
  Loader2,
  Search,
} from "lucide-react";
import { useState } from "react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Metric } from "./index";

const typeIcons = {
  counter: Activity,
  gauge: Gauge,
  histogram: BarChart,
  summary: Clock,
};

const typeColors = {
  counter: "text-blue-400",
  gauge: "text-green-400",
  histogram: "text-purple-400",
  summary: "text-orange-400",
};

export function MetricExplorer() {
  const [search, setSearch] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);

  const { data, error, isLoading, refetch } = trpc.admin.metricsList.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  const metricsData = (data?.metrics as unknown as Metric[]) || [];
  const filtered = metricsData.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading metrics...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Metric List */}
      <div className="w-72 border-white/5 border-r">
        <div className="border-white/5 border-b p-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-3 pl-8 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics..."
              value={search}
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="space-y-1 p-2">
            {filtered.map((metric) => {
              const Icon = typeIcons[metric.type] || Activity;
              const color = typeColors[metric.type] || "text-biolum";

              return (
                <button
                  className={cn(
                    "w-full rounded-lg p-2 text-left transition-colors",
                    selectedMetric?.name === metric.name
                      ? "bg-biolum/20"
                      : "hover:bg-white/5"
                  )}
                  key={metric.name}
                  onClick={() => setSelectedMetric(metric)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="truncate font-mono text-sm">
                      {metric.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Metric Detail */}
      <div className="flex-1 overflow-auto p-4">
        {selectedMetric ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-mono text-lg">{selectedMetric.name}</h3>
              <p className="mt-1 text-biolum-dim text-sm">
                {selectedMetric.help}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-biolum-dim text-xs">Type</div>
                <div className="mt-1 font-medium capitalize">
                  {selectedMetric.type}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-biolum-dim text-xs">Total Values</div>
                <div className="mt-1 font-mono text-lg">
                  {selectedMetric.values.length}
                </div>
              </div>
            </div>

            {selectedMetric.values.length > 0 && (
              <div className="space-y-2">
                <div className="text-biolum-dim text-xs uppercase tracking-wider">
                  Values
                </div>
                <div className="space-y-1">
                  {selectedMetric.values.map((v, i) => (
                    <div
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-2 text-sm"
                      key={`${selectedMetric.name}-val-${i}`}
                    >
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(v.labels).map(([key, val]) => (
                          <span
                            className="rounded bg-biolum/10 px-1.5 py-0.5 font-mono text-[10px] text-biolum"
                            key={key}
                          >
                            {key}={val}
                          </span>
                        ))}
                        {Object.keys(v.labels).length === 0 && (
                          <span className="text-biolum-dim italic">
                            no labels
                          </span>
                        )}
                      </div>
                      <div className="font-medium font-mono text-biolum">
                        {v.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            Select a metric to view details
          </div>
        )}
      </div>
    </div>
  );
}
