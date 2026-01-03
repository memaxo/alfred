"use client";

/**
 * Alert Config - Configure metric alerts
 */

import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Alert = {
  id: string;
  name: string;
  query: string;
  condition: string;
  severity: "warning" | "critical";
  enabled: boolean;
};

const mockAlerts: Alert[] = [
  {
    id: "1",
    name: "High Error Rate",
    query: 'rate(http_requests_total{status=~"5.."}[5m])',
    condition: "> 0.1",
    severity: "critical",
    enabled: true,
  },
  {
    id: "2",
    name: "Memory Usage High",
    query: "memory_usage_bytes / memory_limit_bytes",
    condition: "> 0.8",
    severity: "warning",
    enabled: true,
  },
  {
    id: "3",
    name: "Slow Requests",
    query: "histogram_quantile(0.95, http_request_duration_seconds)",
    condition: "> 1",
    severity: "warning",
    enabled: false,
  },
];

export function AlertConfig() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-white/5 border-b p-4">
        <span className="font-medium">Alert Rules</span>
        <Button className="gap-1" size="sm">
          <Plus className="h-3 w-3" />
          New Alert
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {mockAlerts.map((alert) => (
            <div
              className={cn(
                "rounded-lg border p-3",
                alert.enabled
                  ? "border-white/10 bg-white/5"
                  : "border-white/5 bg-white/5 opacity-50"
              )}
              key={alert.id}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bell
                    className={cn(
                      "h-4 w-4",
                      alert.severity === "critical"
                        ? "text-red-400"
                        : "text-yellow-400"
                    )}
                  />
                  <span className="font-medium">{alert.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs capitalize",
                      alert.severity === "critical"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    )}
                  >
                    {alert.severity}
                  </span>
                  <Button className="h-6 w-6" size="icon" variant="ghost">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="font-mono text-biolum-dim text-xs">
                  {alert.query}
                </div>
                <div className="text-biolum">
                  Condition:{" "}
                  <span className="font-mono">{alert.condition}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={alert.enabled}
                    className="accent-biolum"
                    readOnly
                    type="checkbox"
                  />
                  Enabled
                </label>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
