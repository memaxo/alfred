"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export type ChartPoint = {
  name: string;
  value: number;
};

export type ChartProps = {
  title?: string;
  data: ChartPoint[];
  height?: number;
  className?: string;
  empty?: ReactNode;
};

export function Chart({
  title,
  data,
  height = 256,
  className,
  empty,
}: ChartProps) {
  return (
    <div className={cn("w-full", className)}>
      {title && <div className="mb-2 text-biolum-dim text-sm">{title}</div>}
      <div className="w-full" style={{ height }}>
        {data.length > 0 ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid
                horizontal={false}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
              />
              <XAxis
                fontSize={12}
                stroke="rgba(255,255,255,0.35)"
                type="number"
              />
              <YAxis
                dataKey="name"
                fontSize={12}
                stroke="rgba(255,255,255,0.35)"
                type="category"
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                }}
                itemStyle={{ color: "#00f3ff" }}
              />
              <Bar
                dataKey="value"
                fill="rgba(0, 243, 255, 0.85)"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          (empty ?? (
            <div className="flex h-full items-center justify-center text-biolum-dim italic">
              No data
            </div>
          ))
        )}
      </div>
    </div>
  );
}
