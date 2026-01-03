"use client";

/**
 * Dashboard Builder - Create custom metric dashboards
 */

import { Maximize2, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Panel = {
  id: string;
  title: string;
  type: "line" | "gauge" | "stat" | "table";
  query: string;
  width: 1 | 2 | 3;
};

const mockPanels: Panel[] = [
  {
    id: "1",
    title: "Request Rate",
    type: "line",
    query: "rate(http_requests_total[5m])",
    width: 2,
  },
  {
    id: "2",
    title: "Error Rate",
    type: "gauge",
    query: 'rate(http_requests_total{status=~"5.."}[5m])',
    width: 1,
  },
  {
    id: "3",
    title: "Active Users",
    type: "stat",
    query: "active_connections",
    width: 1,
  },
  {
    id: "4",
    title: "Response Time",
    type: "line",
    query: "histogram_quantile(0.95, http_request_duration_seconds)",
    width: 2,
  },
  {
    id: "5",
    title: "Top Endpoints",
    type: "table",
    query: "topk(5, rate(http_requests_total[1h]))",
    width: 1,
  },
];

export function DashboardBuilder() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-white/5 border-b p-4">
        <span className="font-medium">Dashboard</span>
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
          {mockPanels.map((panel) => (
            <div
              className={cn(
                "rounded-lg border border-white/10 bg-white/5",
                panel.width === 2 && "col-span-2",
                panel.width === 3 && "col-span-3"
              )}
              key={panel.id}
            >
              <div className="flex items-center justify-between border-white/5 border-b p-2">
                <span className="text-sm">{panel.title}</span>
                <Button className="h-6 w-6" size="icon" variant="ghost">
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="h-32 p-2">
                {panel.type === "line" && <MockLineChart />}
                {panel.type === "gauge" && <MockGauge />}
                {panel.type === "stat" && <MockStat />}
                {panel.type === "table" && <MockTable />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockLineChart() {
  return (
    <div className="flex h-full items-end gap-1">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          className="flex-1 rounded-t bg-biolum/60"
          key={i}
          style={{ height: `${30 + Math.random() * 70}%` }}
        />
      ))}
    </div>
  );
}

function MockGauge() {
  const value = 0.15;
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="relative h-16 w-16">
        <svg className="-rotate-90 h-full w-full" viewBox="0 0 36 36">
          <path
            className="stroke-white/10"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            strokeWidth="3"
          />
          <path
            className="stroke-green-500"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            strokeDasharray={`${value * 100}, 100`}
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-sm">
          {(value * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function MockStat() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="font-mono text-3xl text-biolum">42</div>
      <div className="text-biolum-dim text-xs">current</div>
    </div>
  );
}

function MockTable() {
  return (
    <div className="h-full overflow-auto text-xs">
      <table className="w-full">
        <tbody>
          {[
            "/api/chat",
            "/api/agents",
            "/api/workflow",
            "/healthz",
            "/api/auth",
          ].map((ep) => (
            <tr className="border-white/5 border-b" key={ep}>
              <td className="py-1 font-mono">{ep}</td>
              <td className="py-1 text-right">
                {Math.floor(Math.random() * 1000)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
