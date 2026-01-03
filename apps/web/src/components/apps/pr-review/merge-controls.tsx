"use client";

/**
 * Merge Controls - Merge button with biometric verification
 */

import { Check, Fingerprint, GitMerge, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MergeControlsProps = {
  prId: string;
  className?: string;
};

export function MergeControls({ prId: _prId, className }: MergeControlsProps) {
  const [merging, setMerging] = useState(false);
  const [biometricPending, setBiometricPending] = useState(false);

  // Mock status
  const canMerge = true;
  const ciPassed = true;
  const reviewApproved = true;
  const policyPassed = true;

  const handleMerge = async () => {
    setBiometricPending(true);
    // TODO: Trigger biometric verification
    await new Promise((r) => setTimeout(r, 2000));
    setBiometricPending(false);
    setMerging(true);
    // TODO: Call merge endpoint
    await new Promise((r) => setTimeout(r, 1500));
    setMerging(false);
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
          {biometricPending && (
            <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-1.5 text-purple-400 text-sm">
              <Fingerprint className="h-4 w-4 animate-pulse" />
              <span>Verify with Touch ID</span>
            </div>
          )}

          <Button
            className={cn(
              "gap-2",
              canMerge
                ? "bg-purple-600 hover:bg-purple-700"
                : "cursor-not-allowed opacity-50"
            )}
            disabled={!canMerge || merging || biometricPending}
            onClick={handleMerge}
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Merging...
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
