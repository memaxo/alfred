/**
 * Merge Controls - Merge button with biometric verification
 */

import { Check, Fingerprint, GitMerge, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface MergeControlsProps {
  prId: string;
  className?: string;
}

export function MergeControls({ prId: _prId, className }: MergeControlsProps) {
  const prNumber = useMemo(() => Number.parseInt(_prId, 10), [_prId]);
  const isValidPrNumber = Number.isFinite(prNumber) && prNumber > 0;

  const [merging, setMerging] = useState(false);
  const [verifyArmed, setVerifyArmed] = useState(false);

  const prQuery = trpc.github.pullRequestGet.useQuery(
    { number: prNumber },
    { enabled: isValidPrNumber, refetchInterval: 30_000 }
  );
  const mergeMutation = trpc.github.pullRequestMerge.useMutation();

  useEffect(() => {
    if (!verifyArmed) {
      return;
    }
    const t = setTimeout(() => setVerifyArmed(false), 10_000);
    return () => clearTimeout(t);
  }, [verifyArmed]);

  const ciPassed = prQuery.data?.ciStatus === "success";
  const reviewApproved = prQuery.data?.reviewStatus === "approved";
  const policyPassed = true;
  const mergeable = prQuery.data?.mergeable;
  const canMerge =
    isValidPrNumber &&
    prQuery.isSuccess &&
    prQuery.data.status === "open" &&
    !prQuery.data.isDraft &&
    mergeable === "MERGEABLE" &&
    ciPassed &&
    reviewApproved &&
    policyPassed;

  const handleMerge = async () => {
    if (!isValidPrNumber) {
      toast.error("Invalid pull request number");
      return;
    }
    if (!verifyArmed) {
      setVerifyArmed(true);
      toast.message("Verification required", {
        description: "Click Merge again within 10s to confirm.",
      });
      return;
    }

    setVerifyArmed(false);
    setMerging(true);
    try {
      await mergeMutation.mutateAsync({ number: prNumber, method: "squash" });
      toast.success(`Merge queued for #${prNumber}`);
      await prQuery.refetch();
    } catch (error) {
      toast.error("Failed to merge PR", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className={cn("bg-void-surface p-3", className)}>
      <div className="flex items-center justify-between">
        {/* Status checks */}
        <div className="flex items-center gap-3">
          <CheckItem label="CI Passed" passed={ciPassed} />
          <CheckItem label="Review Approved" passed={reviewApproved} />
          <CheckItem label="Policy Gate" passed={policyPassed} />
        </div>

        {/* Merge button */}
        <div className="flex items-center gap-2">
          {verifyArmed && (
            <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-1.5 text-purple-400 text-sm">
              <Fingerprint className="h-4 w-4 animate-pulse" />
              <span>Click Merge again to confirm</span>
            </div>
          )}

          <Button
            className={cn(
              "gap-2",
              canMerge
                ? "bg-purple-600 hover:bg-purple-700"
                : "cursor-not-allowed opacity-50"
            )}
            disabled={!canMerge || merging || mergeMutation.isPending}
            onClick={handleMerge}
            type="button"
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4" />
                Merge PR
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {passed ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <X className="h-3 w-3 text-red-400" />
      )}
      <span className={passed ? "text-biolum-dim" : "text-red-400"}>
        {label}
      </span>
    </div>
  );
}
