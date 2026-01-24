"use client";

/**
 * Approval Queue - Pending approval requests
 */

import { Check, Clock, Loader2, X } from "lucide-react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export function ApprovalQueue() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.admin.approvalsList.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  const resolveMutation = trpc.admin.approvalsResolve.useMutation({
    onSuccess: () => {
      void utils.admin.approvalsList.invalidate();
    },
  });

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

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
        Failed to load approvals
      </div>
    );
  }

  const requests = data?.requests ?? [];

  if (requests.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        No pending approvals
      </div>
    );
  }

  const handleResolve = (approvalId: string, decision: "approve" | "deny") => {
    resolveMutation.mutate({ approvalId, decision });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {requests.map((request) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={request.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{request.action}</span>
                </div>
                <p className="mt-1 text-biolum-dim text-sm">
                  {request.resource}
                </p>
              </div>
              <div className="flex items-center gap-1 text-biolum-dim text-xs">
                <Clock className="h-3 w-3" />
                {request.created ? formatTimeAgo(request.created) : "-"}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1 bg-green-500/20 text-green-400 hover:bg-green-500/30"
                disabled={resolveMutation.isPending}
                onClick={() => handleResolve(request.id, "approve")}
                size="sm"
                variant="outline"
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                className="flex-1 gap-1 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                disabled={resolveMutation.isPending}
                onClick={() => handleResolve(request.id, "deny")}
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

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}
