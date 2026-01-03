"use client";

/**
 * Approval Queue - Pending approval requests
 */

import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ApprovalRequest = {
  id: string;
  timestamp: Date;
  action: string;
  description: string;
  scope: string;
  risk: "low" | "medium" | "high";
};

const mockRequests: ApprovalRequest[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    action: "git.push",
    description: "Push 3 commits to origin/main",
    scope: "repository",
    risk: "medium",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
    action: "api.external",
    description: "Call OpenAI API for embeddings",
    scope: "network",
    risk: "low",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    action: "db.migrate",
    description: "Run database migration: add_users_table",
    scope: "database",
    risk: "high",
  },
];

const riskColors = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

export function ApprovalQueue() {
  if (mockRequests.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        No pending approvals
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockRequests.map((request) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={request.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{request.action}</span>
                  <span className={cn("text-xs", riskColors[request.risk])}>
                    {request.risk} risk
                  </span>
                </div>
                <p className="mt-1 text-biolum-dim text-sm">
                  {request.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-biolum-dim text-xs">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(request.timestamp)}
              </div>
            </div>

            <div className="mb-3 text-biolum-dim text-xs">
              Scope: <span className="font-mono">{request.scope}</span>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1 bg-green-500/20 text-green-400 hover:bg-green-500/30"
                size="sm"
                variant="outline"
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                className="flex-1 gap-1 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                size="sm"
                variant="outline"
              >
                <X className="h-3 w-3" />
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}
