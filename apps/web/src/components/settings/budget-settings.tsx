"use client";

import { AlertCircle, DollarSign, Gauge, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";

interface BudgetSettingsProps {
  className?: string;
}

export function BudgetSettings({ className }: BudgetSettingsProps) {
  const utils = trpc.useUtils();

  // Queries
  const budgetQuery = trpc.budget.get.useQuery();
  const usageQuery = trpc.budget.usage.useQuery();
  const remainingQuery = trpc.budget.remaining.useQuery();
  const forecastQuery = trpc.budget.forecast.useQuery();

  // Mutations
  const setBudget = trpc.budget.set.useMutation({
    onSuccess: async () => {
      toast.success("Budget settings saved");
      await utils.budget.get.invalidate();
      await utils.budget.remaining.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to save budget settings");
    },
  });

  // Local state for form
  const [dailyDollarLimit, setDailyDollarLimit] = useState<string>("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState<string>("");
  const [costPriority, setCostPriority] = useState<string>("balanced");

  // Initialize form from query data
  const budget = budgetQuery.data;
  const usage = usageQuery.data;
  const remaining = remainingQuery.data;
  const forecast = forecastQuery.data;

  const handleSave = () => {
    setBudget.mutate({
      dailyDollarLimit: dailyDollarLimit
        ? Number.parseFloat(dailyDollarLimit)
        : null,
      dailyTokenLimit: dailyTokenLimit
        ? Number.parseInt(dailyTokenLimit, 10)
        : null,
      costPriority: costPriority as
        | "minimize"
        | "balanced"
        | "maximize_quality",
    });
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  return (
    <div className={className}>
      {/* Usage Overview */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Gauge className="h-4 w-4" />
          Today's Usage
        </h3>

        {usage && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-biolum-faint text-xs">Cost</p>
              <p className="font-mono text-lg text-white">
                {formatCurrency(usage.totalCostCents)}
              </p>
            </div>
            <div>
              <p className="text-biolum-faint text-xs">Tokens</p>
              <p className="font-mono text-lg text-white">
                {formatTokens(usage.totalTokens)}
              </p>
            </div>
            <div>
              <p className="text-biolum-faint text-xs">Requests</p>
              <p className="font-mono text-lg text-white">
                {usage.requestCount}
              </p>
            </div>
            <div>
              <p className="text-biolum-faint text-xs">Blocked</p>
              <p className="font-mono text-lg text-white">
                {usage.blockedCount}
              </p>
            </div>
          </div>
        )}

        {remaining?.hasLimits && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-biolum-faint">Budget Used</span>
              <span className="text-white">
                {Math.round((remaining.percentUsed ?? 0) * 100)}%
              </span>
            </div>
            <Progress
              className="h-2"
              value={(remaining.percentUsed ?? 0) * 100}
            />
          </div>
        )}
      </section>

      {/* Forecast Warning */}
      {forecast?.warnings && forecast.warnings.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200 text-sm">
                Forecast Warning
              </p>
              {forecast.warnings.map((warning, i) => (
                <p className="text-amber-300/80 text-xs" key={i}>
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Budget Limits */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <DollarSign className="h-4 w-4" />
          Daily Limits
        </h3>

        <div className="space-y-4">
          <div>
            <Label className="text-biolum-faint text-xs" htmlFor="daily-dollar">
              Daily Dollar Limit
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-biolum-faint">$</span>
              <Input
                className="flex-1"
                id="daily-dollar"
                onChange={(e) => setDailyDollarLimit(e.target.value)}
                placeholder={
                  budget?.dailyDollarLimit?.toString() ?? "Unlimited"
                }
                type="number"
                value={dailyDollarLimit}
              />
            </div>
          </div>

          <div>
            <Label className="text-biolum-faint text-xs" htmlFor="daily-token">
              Daily Token Limit
            </Label>
            <Input
              className="mt-1"
              id="daily-token"
              onChange={(e) => setDailyTokenLimit(e.target.value)}
              placeholder={budget?.dailyTokenLimit?.toString() ?? "Unlimited"}
              type="number"
              value={dailyTokenLimit}
            />
          </div>
        </div>
      </section>

      {/* Cost Priority */}
      <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-biolum text-sm">
          <Zap className="h-4 w-4" />
          Cost Priority
        </h3>

        <Select
          onValueChange={setCostPriority}
          value={costPriority || budget?.costPriority || "balanced"}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minimize">
              <div className="flex items-center gap-2">
                <span>💰 Minimize Cost</span>
              </div>
            </SelectItem>
            <SelectItem value="balanced">
              <div className="flex items-center gap-2">
                <span>⚖️ Balanced</span>
              </div>
            </SelectItem>
            <SelectItem value="maximize_quality">
              <div className="flex items-center gap-2">
                <span>🎯 Maximize Quality</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <p className="mt-2 text-biolum-faint text-xs">
          {costPriority === "minimize" &&
            "Always use the cheapest models available."}
          {costPriority === "balanced" &&
            "Balance cost and quality based on task complexity."}
          {costPriority === "maximize_quality" &&
            "Prefer higher quality models even at higher cost."}
        </p>
      </section>

      {/* Save Button */}
      <Button
        className="w-full"
        disabled={setBudget.isPending}
        onClick={handleSave}
      >
        {setBudget.isPending ? "Saving..." : "Save Budget Settings"}
      </Button>
    </div>
  );
}
