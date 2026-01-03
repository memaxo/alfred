"use client";

/**
 * Decision Log - Audit trail of policy decisions
 */

import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type DecisionType = "allow" | "deny";

const decisionIcons: Record<
  DecisionType,
  React.ComponentType<{ className?: string }>
> = {
  allow: Check,
  deny: X,
};

const decisionColors: Record<DecisionType, string> = {
  allow: "text-green-400",
  deny: "text-red-400",
};

export function DecisionLog() {
  const { data, isLoading, error } = trpc.admin.policyList.useQuery({
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Failed to load policy decisions
      </div>
    );
  }

  const decisions = data?.decisions ?? [];

  if (decisions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        No policy decisions recorded yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="border-white/10 border-b text-left text-biolum-dim text-xs">
              <th className="pb-2">Time</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Resource</th>
              <th className="pb-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => {
              const decisionType = decision.decision as DecisionType;
              const Icon = decisionIcons[decisionType] ?? AlertTriangle;
              const color = decisionColors[decisionType] ?? "text-yellow-400";

              return (
                <tr
                  className="border-white/5 border-b text-sm"
                  key={decision.id}
                >
                  <td className="py-2 text-biolum-dim text-xs">
                    {decision.timestamp ? formatTime(decision.timestamp) : "-"}
                  </td>
                  <td className="py-2 font-mono text-xs">{decision.action}</td>
                  <td className="py-2 text-biolum-dim text-xs">
                    {decision.resource}
                  </td>
                  <td className="py-2">
                    <div className={cn("flex items-center gap-1", color)}>
                      <Icon className="h-3 w-3" />
                      <span className="text-xs capitalize">
                        {decision.decision}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
