"use client";

/**
 * Policy Section - Configure autonomy and permission preferences
 *
 * User-facing policy preferences for ALFRED's autonomy levels.
 *
 * @see @alfred/policy package
 */

import { AlertTriangle, Info, Loader2, Shield } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type PolicyLevel = "ask" | "allow" | "deny";

const levelColors: Record<PolicyLevel, string> = {
  ask: "border-yellow-500/50 bg-yellow-500/10",
  allow: "border-green-500/50 bg-green-500/10",
  deny: "border-red-500/50 bg-red-500/10",
};

const riskColors = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

interface Preference {
  id: string;
  key: string;
  value: unknown;
  confidence: number;
  source: string;
}

export function PolicySection() {
  const utils = trpc.useUtils();
  const { data: preferences, isLoading } = trpc.preference.list.useQuery();

  const updatePolicy = trpc.preference.set.useMutation({
    onSuccess: () => {
      utils.preference.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Policy Preferences</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Configure what ALFRED can do automatically vs. what requires your
          approval.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
        <Info className="mt-0.5 h-4 w-4 text-blue-400" />
        <div className="text-sm">
          <span className="font-medium text-blue-400">Tip:</span>{" "}
          <span className="text-blue-300">
            Start with "Ask First" for sensitive operations, then allow after
            building trust.
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {(preferences as unknown as Preference[])?.map((pref) => (
          <div
            className={cn(
              "rounded-lg border p-4",
              levelColors[pref.value as PolicyLevel] || levelColors.ask
            )}
            key={pref.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-biolum" />
                <span className="font-medium">{pref.key}</span>
                <span
                  className={cn(
                    "text-xs uppercase tracking-wider",
                    pref.confidence < 0.5 ? riskColors.high : riskColors.low
                  )}
                >
                  {pref.confidence < 0.5 ? "high" : "low"} risk
                </span>
              </div>
              <Select
                defaultValue={pref.value as string}
                onValueChange={(level) =>
                  updatePolicy.mutate({
                    key: pref.key,
                    value: level,
                  })
                }
              >
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="ask">Ask First</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-biolum-dim text-sm">Preference for {pref.key}</p>

            <div className="mt-2 font-mono text-biolum-dim text-xs">
              Source: {pref.source}
            </div>
          </div>
        ))}
      </div>

      {/* Warning */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
        <div className="text-sm text-yellow-300">
          Changes to policy preferences take effect immediately. Use caution
          when allowing high-risk operations automatically.
        </div>
      </div>
    </div>
  );
}
