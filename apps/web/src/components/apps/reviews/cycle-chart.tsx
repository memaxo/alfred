"use client";

/**
 * ReviewCycleTimeChart - Collapsible chart showing cycle time trends
 */

import { AlertTriangle, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface ReviewCycleTimeChartProps {
  className?: string;
}

export function ReviewCycleTimeChart({ className }: ReviewCycleTimeChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const { data, isLoading } = trpc.review.cycleTime.useQuery(
    { period },
    { refetchInterval: 60_000 }
  );

  // Memoize formatted display values
  const displayData = useMemo(() => {
    if (!data) {
      return null;
    }
    return {
      avgCycleTime: formatMs(data.avgCycleTime),
      codeAvg: formatMs(data.codeAvg),
      toolAvg: formatMs(data.toolAvg),
      slaBreaches: data.slaBreaches,
      trend: data.trend,
    };
  }, [data]);

  if (isLoading || !displayData) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div className={cn("border-t border-border", className)}>
      {/* Header - always visible */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Cycle Time
            </h3>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>
              Avg: <strong>{displayData.avgCycleTime}</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              Code: <strong>{displayData.codeAvg}</strong>
            </span>
            <span>
              Tools: <strong>{displayData.toolAvg}</strong>
            </span>
            {displayData.slaBreaches > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" />
                {displayData.slaBreaches} SLA breaches
              </Badge>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded chart */}
      {expanded && (
        <div className="p-4 pt-0">
          <div className="flex justify-end mb-4">
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Last 24h</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {displayData.trend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayData.trend}>
                  <defs>
                    <linearGradient
                      id="cycleGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickFormatter={formatMs}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatMs(value),
                      "Avg Cycle Time",
                    ]}
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString()
                    }
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgMs"
                    stroke="hsl(var(--primary))"
                    fill="url(#cycleGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No data for this period
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms === 0) {
    return "0s";
  }
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-t border-border p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}
