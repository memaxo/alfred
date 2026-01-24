"use client";

/**
 * TrustProgressBar - Shows progress toward auto-approve thresholds
 */

import { CheckCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface TrustProgressBarProps {
  className?: string;
}

export function TrustProgressBar({ className }: TrustProgressBarProps) {
  const { data, isLoading } = trpc.review.trustProgress.useQuery(undefined, {
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return <TrustProgressSkeleton className={className} />;
  }

  if (data.length === 0) {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Trust Progress
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Approve reviews to build trust patterns
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Trust Progress
        </h3>
      </div>

      <div className="space-y-3">
        {data.slice(0, 5).map((pattern) => (
          <TrustRow key={pattern.actionType} pattern={pattern} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        5 approvals = auto-approve enabled
      </p>
    </div>
  );
}

interface TrustPattern {
  actionType: string;
  approvalCount: number;
  threshold: number;
  enabled: boolean;
  lastApproved?: string | Date;
}

function TrustRow({ pattern }: { pattern: TrustPattern }) {
  const progress = Math.min(
    (pattern.approvalCount / pattern.threshold) * 100,
    100
  );
  const remaining = Math.max(pattern.threshold - pattern.approvalCount, 0);

  // Format action type for display
  const displayName = pattern.actionType
    .replace(/^(tool|memory|message|workflow|code):/, "")
    .replace(/_/g, " ");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span
          className="text-foreground truncate max-w-[150px]"
          title={displayName}
        >
          {displayName}
        </span>
        {pattern.enabled ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            <CheckCircle className="w-3 h-3" />
            Auto
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">
            {remaining} more
          </span>
        )}
      </div>
      <Progress
        value={progress}
        className={cn("h-1.5", pattern.enabled && "[&>div]:bg-green-500")}
      />
    </div>
  );
}

function TrustProgressSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-4", className)}>
      <Skeleton className="h-4 w-28" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
