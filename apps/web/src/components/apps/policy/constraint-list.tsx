"use client";

/**
 * Constraint List - Active autonomy constraints
 */

import { Loader2, Lock, Shield, Unlock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type ConstraintLevel = "strict" | "monitor" | "relaxed";

const levelColors: Record<ConstraintLevel, string> = {
  strict: "border-red-500/50 bg-red-500/10",
  monitor: "border-yellow-500/50 bg-yellow-500/10",
  relaxed: "border-green-500/50 bg-green-500/10",
};

const levelLabels: Record<ConstraintLevel, string> = {
  strict: "Strict",
  monitor: "Monitor",
  relaxed: "Relaxed",
};

export function ConstraintList() {
  const { data, isLoading, error } = trpc.admin.policyConstraints.useQuery();

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
        Failed to load constraints
      </div>
    );
  }

  const constraints = data?.constraints ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {constraints.map((constraint) => {
          const level = constraint.level as ConstraintLevel;
          const levelColor = levelColors[level] ?? levelColors.monitor;
          const levelLabel = levelLabels[level] ?? level;

          return (
            <div
              className={cn(
                "rounded-lg border p-3",
                constraint.enabled
                  ? levelColor
                  : "border-white/10 bg-white/5 opacity-50"
              )}
              key={constraint.id}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-biolum" />
                  <span className="font-medium capitalize">
                    {constraint.scope}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs capitalize",
                      level === "strict" && "bg-red-500/20 text-red-400",
                      level === "monitor" && "bg-yellow-500/20 text-yellow-400",
                      level === "relaxed" && "bg-green-500/20 text-green-400"
                    )}
                  >
                    {levelLabel}
                  </span>
                  {constraint.enabled ? (
                    <Lock className="h-4 w-4 text-biolum" />
                  ) : (
                    <Unlock className="h-4 w-4 text-biolum-dim" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-biolum-dim text-sm">{constraint.rule}</p>
              <div className="mt-2 text-biolum-dim text-xs">
                Scope: <span className="font-mono">{constraint.scope}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
