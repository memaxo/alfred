"use client";

import { AlertTriangle, CheckCircle, Clock, Shield } from "lucide-react";

import { trpc } from "@/utils/trpc";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "success" | "danger";
  href?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  href,
}: StatCardProps) {
  const variantStyles = {
    default: "text-biolum-dim",
    warning: "text-amber-400",
    success: "text-emerald-400",
    danger: "text-red-400",
  };

  const content = (
    <div className="flex items-center gap-3 rounded-lg bg-void-surface/40 p-3 transition-colors hover:bg-void-surface/60">
      <Icon className={`h-5 w-5 ${variantStyles[variant]}`} />
      <div className="flex-1">
        <div className="font-mono text-lg text-biolum">{value}</div>
        <div className="text-[10px] text-biolum-dim uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}

export function ReviewSummaryWidget() {
  const { data, isLoading, error } = trpc.review.dashboardSummary.useQuery(
    undefined,
    {
      refetchInterval: 30_000,
    }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-16 rounded-lg bg-void-surface/20" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 rounded-lg bg-void-surface/20" />
          <div className="h-16 rounded-lg bg-void-surface/20" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center text-red-400 text-sm">
        Failed to load review summary
      </div>
    );
  }

  const urgentCount = data.pending.critical + data.pending.high;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-biolum text-sm">Reviews</h3>
        <a
          className="text-biolum-dim text-xs hover:text-biolum"
          href="/reviews"
        >
          View all →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          href="/reviews"
          icon={Clock}
          label="Pending"
          value={data.pending.total}
          variant={data.pending.total > 10 ? "warning" : "default"}
        />
        <StatCard
          href="/reviews"
          icon={AlertTriangle}
          label="Urgent"
          value={urgentCount}
          variant={urgentCount > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={CheckCircle}
          label="Approval Rate"
          value={`${data.performance.approvalRate}%`}
          variant={data.performance.approvalRate >= 80 ? "success" : "default"}
        />
        <StatCard
          icon={Shield}
          label="Trust Score"
          value={`${Math.round(data.performance.trustScore * 100)}%`}
          variant={data.performance.trustScore >= 0.8 ? "success" : "default"}
        />
      </div>

      {data.pending.blocked > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-amber-400 text-xs">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {data.pending.blocked} review{data.pending.blocked !== 1 ? "s" : ""}{" "}
            blocking work
          </span>
        </div>
      )}
    </div>
  );
}
