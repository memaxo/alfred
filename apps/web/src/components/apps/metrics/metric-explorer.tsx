"use client";

/**
 * Metric Explorer - Browse available metrics
 */

import { Activity, BarChart, Clock, Gauge, Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Metric } from "./index";

const mockMetrics: Metric[] = [
  {
    name: "http_requests_total",
    type: "counter",
    help: "Total HTTP requests",
    labels: ["method", "status"],
    value: 12_453,
  },
  {
    name: "http_request_duration_seconds",
    type: "histogram",
    help: "Request duration",
    labels: ["method"],
    value: 0.124,
  },
  {
    name: "active_connections",
    type: "gauge",
    help: "Current active connections",
    labels: [],
    value: 42,
  },
  {
    name: "memory_usage_bytes",
    type: "gauge",
    help: "Memory usage in bytes",
    labels: ["type"],
    value: 524_288_000,
  },
  {
    name: "agent_tasks_processed",
    type: "counter",
    help: "Tasks processed by agents",
    labels: ["agent"],
    value: 891,
  },
  {
    name: "cognitive_transitions_total",
    type: "counter",
    help: "Cognitive state transitions",
    labels: ["from", "to"],
    value: 156,
  },
  {
    name: "llm_tokens_total",
    type: "counter",
    help: "Total LLM tokens used",
    labels: ["model"],
    value: 2_456_789,
  },
  {
    name: "db_query_duration_seconds",
    type: "histogram",
    help: "Database query duration",
    labels: ["query"],
    value: 0.045,
  },
];

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

  const filtered = mockMetrics.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

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
              const Icon = typeIcons[metric.type];
              const color = typeColors[metric.type];

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
      <div className="flex-1 p-4">
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
                <div className="text-biolum-dim text-xs">Current Value</div>
                <div className="mt-1 font-mono text-lg">
                  {selectedMetric.value?.toLocaleString()}
                </div>
              </div>
            </div>

            {selectedMetric.labels.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-biolum-dim text-xs">Labels</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMetric.labels.map((label) => (
                    <span
                      className="rounded bg-white/10 px-2 py-0.5 font-mono text-sm"
                      key={label}
                    >
                      {label}
                    </span>
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
