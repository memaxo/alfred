"use client";

/**
 * Dashboard Builder - Create custom metric dashboards
 */

import { Loader2, Maximize2, Plus, Settings } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import type { Metric } from "./index";

export function DashboardBuilder() {
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading metrics...
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
        <div className="flex gap-2">
          <Button className="gap-1" size="sm" variant="outline">
            <Settings className="h-3 w-3" />
            Settings
          </Button>
          <Button className="gap-1" size="sm">
            <Plus className="h-3 w-3" />
            Add Panel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-4">
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
              <Button className="h-6 w-6" size="icon" variant="ghost">
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="h-64 p-4">
              {toolCallsData.length > 0 ? (
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={toolCallsData} layout="vertical">
                    <CartesianGrid
                      horizontal={false}
                      stroke="#333"
                      strokeDasharray="3 3"
                    />
                    <XAxis fontSize={12} stroke="#666" type="number" />
                    <YAxis
                      dataKey="name"
                      fontSize={12}
                      stroke="#666"
                      type="category"
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#00f3ff" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {toolCallsData.map((_entry, index) => (
                        <Cell
                          fill={`rgba(0, 243, 255, ${1 - index * 0.15})`}
                          key={`cell-${index}`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-biolum-dim italic">
                  No tool call data available
                </div>
              )}
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
        </div>
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
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[10px] text-biolum-dim">{subtitle}</div>
    </div>
  );
}
