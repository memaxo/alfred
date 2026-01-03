"use client";

/**
 * Decision Log - Audit trail of policy decisions
 */

import { AlertTriangle, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PolicyDecision } from "./index";

const mockDecisions: PolicyDecision[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    action: "file.write",
    scope: "workspace",
    decision: "allowed",
    reason: "Within autonomy level for workspace operations",
    autonomyLevel: 3,
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    action: "git.push",
    scope: "repository",
    decision: "escalated",
    reason: "Push operations require user confirmation",
    autonomyLevel: 2,
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    action: "npm.install",
    scope: "dependencies",
    decision: "allowed",
    reason: "Package installation within allowed scope",
    autonomyLevel: 3,
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    action: "api.external",
    scope: "network",
    decision: "denied",
    reason: "External API calls require explicit permission",
    autonomyLevel: 1,
  },
];

const decisionIcons = {
  allowed: Check,
  denied: X,
  escalated: AlertTriangle,
};

const decisionColors = {
  allowed: "text-green-400",
  denied: "text-red-400",
  escalated: "text-yellow-400",
};

export function DecisionLog() {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="border-white/10 border-b text-left text-biolum-dim text-xs">
              <th className="pb-2">Time</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Scope</th>
              <th className="pb-2">Decision</th>
              <th className="pb-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {mockDecisions.map((decision) => {
              const Icon = decisionIcons[decision.decision];
              const color = decisionColors[decision.decision];

              return (
                <tr
                  className="border-white/5 border-b text-sm"
                  key={decision.id}
                >
                  <td className="py-2 text-biolum-dim text-xs">
                    {formatTime(decision.timestamp)}
                  </td>
                  <td className="py-2 font-mono text-xs">{decision.action}</td>
                  <td className="py-2 text-biolum-dim text-xs">
                    {decision.scope}
                  </td>
                  <td className="py-2">
                    <div className={cn("flex items-center gap-1", color)}>
                      <Icon className="h-3 w-3" />
                      <span className="text-xs capitalize">
                        {decision.decision}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs truncate py-2 text-biolum-dim text-xs">
                    {decision.reason}
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
