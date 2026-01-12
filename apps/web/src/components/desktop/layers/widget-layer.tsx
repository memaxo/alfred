"use client";

import { X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Chart } from "@/components/chart";
import { Number as SlidingNumber } from "@/components/number";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

export function WidgetLayer() {
  const { pinnedWidgets, unpinWidget } = useDesktopStore(
    useShallow((s) => ({
      pinnedWidgets: s.pinnedWidgets,
      unpinWidget: s.unpinWidget,
    }))
  );

  const { data: metricsData } = trpc.admin.metricsList.useQuery(undefined, {
    enabled: pinnedWidgets.length > 0,
    refetchInterval: 30_000,
  });

  if (pinnedWidgets.length === 0) {
    return null;
  }

  const getMetricData = (metricName: string) => {
    const metric = metricsData?.metrics?.find((m) => m.name === metricName);
    if (!metric) {
      return [];
    }
    return metric.values
      .map((v) => ({
        name: v.labels.tool || v.labels.agent || "value",
        value: v.value,
      }))
      .slice(0, 5);
  };

  const getMetricSum = (metricName: string) => {
    const metric = metricsData?.metrics?.find((m) => m.name === metricName);
    if (!metric) {
      return 0;
    }
    return metric.values.reduce((acc: number, v) => acc + v.value, 0);
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      data-layer="widgets"
    >
      {pinnedWidgets.map((widget) => (
        <div
          className="group pointer-events-auto absolute"
          key={widget.id}
          style={{
            left: widget.bounds.x,
            top: widget.bounds.y,
            width: widget.bounds.width,
            height: widget.bounds.height,
          }}
        >
          <div className="relative h-full w-full rounded-2xl border border-white/5 bg-void-surface/20 p-3 backdrop-blur-[2px] transition-all hover:border-white/10 hover:bg-void-surface/40">
            <button
              className="-top-2 -right-2 absolute hidden h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white shadow-lg transition-colors hover:bg-red-500 group-hover:flex"
              onClick={() => unpinWidget(widget.id)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>

            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-[10px] text-biolum-dim uppercase tracking-widest">
                {widget.title}
              </span>
            </div>

            {widget.type === "chart" ? (
              <Chart
                className="h-full"
                data={getMetricData(widget.metricName)}
                height={widget.bounds.height - 40}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <SlidingNumber
                  className="font-mono text-3xl text-biolum"
                  value={getMetricSum(widget.metricName)}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
