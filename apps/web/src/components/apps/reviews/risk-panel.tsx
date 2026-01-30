/**
 * RiskAssessmentPanel - Shows aggregated risk counts for pending reviews
 */

import { Shield } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface RiskAssessmentPanelProps {
  className?: string;
}

export function RiskAssessmentPanel({ className }: RiskAssessmentPanelProps) {
  const { data, isLoading } = trpc.review.riskSummary.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  if (isLoading || !data) {
    return <RiskPanelSkeleton className={className} />;
  }

  const total = data.high + data.medium + data.low;
  const highPct = total > 0 ? (data.high / total) * 100 : 0;
  const mediumPct = total > 0 ? (data.medium / total) * 100 : 0;
  const lowPct = total > 0 ? (data.low / total) * 100 : 0;

  return (
    <div className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Risk Summary
        </h3>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No pending reviews</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
            {data.high > 0 && (
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{ width: `${highPct}%` }}
              />
            )}
            {data.medium > 0 && (
              <div
                className="bg-yellow-500 h-full transition-all duration-300"
                style={{ width: `${mediumPct}%` }}
              />
            )}
            {data.low > 0 && (
              <div
                className="bg-green-500 h-full transition-all duration-300"
                style={{ width: `${lowPct}%` }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <RiskRow
              emoji="🔴"
              label="High"
              count={data.high}
              color="text-red-400"
            />
            <RiskRow
              emoji="🟡"
              label="Medium"
              count={data.medium}
              color="text-yellow-400"
            />
            <RiskRow
              emoji="🟢"
              label="Low"
              count={data.low}
              color="text-green-400"
            />
          </div>
        </>
      )}
    </div>
  );
}

function RiskRow({
  emoji,
  label,
  count,
  color,
}: {
  emoji: string;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>{emoji}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={cn("font-mono text-sm font-medium", color)}>
        {count}
      </span>
    </div>
  );
}

function RiskPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-4", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-full" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
