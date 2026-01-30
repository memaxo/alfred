/**
 * Dashboard Builder - Create custom metric dashboards
 */

import { Maximize2, Pin, PinOff, Plus, Settings } from "lucide-react";
import { useCallback, useMemo } from "react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Chart } from "@/components/chart";
import { Grid } from "@/components/grid";
import { Loading } from "@/components/loading";
import { Number as SlidingNumber } from "@/components/number";
import { Toolbar } from "@/components/toolbar";
import { Button } from "@/components/ui/button";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import type { Metric } from "./index";

export function DashboardBuilder() {
  const pinWidget = useDesktopStore((s) => s.pinWidget);
  const unpinWidget = useDesktopStore((s) => s.unpinWidget);
  const pinnedWidgets = useDesktopStore((s) => s.pinnedWidgets);

  const { data, error, isLoading, refetch } = trpc.admin.metricsList.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  const handleSettingsClick = useCallback(() => {}, []);
  const handleAddPanelClick = useCallback(() => {}, []);

  const toolbarActions = useMemo(
    () => [
      {
        id: "settings",
        label: "Settings",
        icon: <Settings className="h-3 w-3" />,
        onClick: handleSettingsClick,
      },
      {
        id: "add",
        label: "Add Panel",
        icon: <Plus className="h-3 w-3" />,
        onClick: handleAddPanelClick,
      },
    ],
    [handleAddPanelClick, handleSettingsClick]
  );

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading message="Loading metrics..." />
      </div>
    );
  }

  const metricList = (data?.metrics as unknown as Metric[]) || [];

  // Find key metrics
  const assistantRequests = metricList.find(
    (m) => m.name === "assistant_generate_requests_total"
  );
  const toolCalls = metricList.find(
    (m) => m.name === "assistant_tool_calls_total"
  );
  const droidRuns = metricList.find((m) => m.name === "droid_exec_runs_total");
  const codexRuns = metricList.find((m) => m.name === "codex_exec_runs_total");

  const getSum = (metric?: Metric) => {
    if (!metric) {
      return 0;
    }
    return metric.values.reduce((acc, v) => acc + v.value, 0);
  };

  const toolCallsData =
    toolCalls?.values
      .map((v) => ({
        name: v.labels.tool || "unknown",
        value: v.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) || [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-white/5 border-b p-4">
        <span className="font-medium">System Overview</span>
        <Toolbar actions={toolbarActions} />
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Grid cols={3}>
          {/* Stats Panels */}
          <StatPanel
            subtitle="Total generations"
            title="Assistant Requests"
            value={getSum(assistantRequests)}
          />
          <StatPanel
            subtitle="Autonomous executions"
            title="Droid Runs"
            value={getSum(droidRuns)}
          />
          <StatPanel
            subtitle="Context validations"
            title="Codex Runs"
            value={getSum(codexRuns)}
          />

          {/* Chart Panel */}
          <div className="col-span-2 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center justify-between border-white/5 border-b p-2">
              <span className="text-sm">Top Tool Invocations</span>
              <div className="flex items-center gap-1">
                {pinnedWidgets.some(
                  (w) => w.metricName === "assistant_tool_calls_total"
                ) ? (
                  <Button
                    className="h-6 w-6"
                    onClick={() => {
                      const widget = pinnedWidgets.find(
                        (w) => w.metricName === "assistant_tool_calls_total"
                      );
                      if (widget) {
                        unpinWidget(widget.id);
                      }
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <PinOff className="h-3 w-3 text-biolum" />
                  </Button>
                ) : (
                  <Button
                    className="h-6 w-6"
                    onClick={() =>
                      pinWidget({
                        type: "chart",
                        title: "Tool Invocations",
                        metricName: "assistant_tool_calls_total",
                        bounds: { x: 20, y: 100, width: 300, height: 200 },
                      })
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <Pin className="h-3 w-3" />
                  </Button>
                )}
                <Button className="h-6 w-6" size="icon" variant="ghost">
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="h-64 p-4">
              <Chart
                data={toolCallsData}
                empty={
                  <div className="flex h-full items-center justify-center text-biolum-dim italic">
                    No tool call data available
                  </div>
                }
              />
            </div>
          </div>

          {/* Table Panel */}
          <div className="rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center justify-between border-white/5 border-b p-2">
              <span className="text-sm">Active Metrics</span>
              <Button className="h-6 w-6" size="icon" variant="ghost">
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="h-64 overflow-auto p-2">
              <table className="w-full text-biolum-dim text-xs">
                <tbody className="divide-y divide-white/5">
                  {metricList.slice(0, 10).map((m) => (
                    <tr key={m.name}>
                      <td
                        className="max-w-[120px] truncate py-2 font-mono"
                        title={m.name}
                      >
                        {m.name}
                      </td>
                      <td className="py-2 text-right font-mono text-biolum">
                        {getSum(m).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Grid>
      </div>
    </div>
  );
}

function StatPanel({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-biolum-dim text-xs uppercase tracking-wider">
        {title}
      </div>
      <div className="mt-2 font-mono text-3xl text-biolum">
        <SlidingNumber value={value} />
      </div>
      <div className="mt-1 text-[10px] text-biolum-dim">{subtitle}</div>
    </div>
  );
}
