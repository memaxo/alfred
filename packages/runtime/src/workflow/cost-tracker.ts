/**
 * Cost Tracker
 *
 * Tracks AI API costs for plan generation and execution.
 * Provides user-facing cost transparency and budget enforcement.
 */

import { costTrackerMetrics } from "@alfred/metrics/metrics-registry";

export type CostPeriod = "day" | "week" | "month" | "year";

export interface CostEntry {
  userId: string;
  planId: string;
  operation: "plan_generation" | "plan_execution" | "pattern_extraction";
  costUsd: number;
  tokensUsed: number;
  timestamp: Date;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  operationsCount: number;
  averageCostPerOperation: number;
  byPeriod: Map<CostPeriod, number>;
  byOperation: Map<string, number>;
}

export interface Budget {
  userId: string;
  period: CostPeriod;
  limitUsd: number;
  currentUsage: number;
  alertThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CostTracker {
  costs: Map<string, CostEntry> = new Map();
  budgets: Map<string, Budget> = new Map();

  trackCost(entry: CostEntry) {
    const key = `${entry.userId}-${entry.planId}-${entry.operation}`;
    const existing = this.costs.get(key);
    const totalCost = existing
      ? existing.costUsd + entry.costUsd
      : entry.costUsd;

    this.costs.set(key, {
      ...entry,
      costUsd: totalCost,
      tokensUsed: existing
        ? existing.tokensUsed + entry.tokensUsed
        : entry.tokensUsed,
    });

    costTrackerMetrics.costUsd.inc({ provider: "unknown" }, entry.costUsd);
    costTrackerMetrics.tokens.inc(
      { provider: "unknown", token_type: "total" },
      entry.tokensUsed
    );
  }

  getCostSummary(userId: string, period: CostPeriod = "month"): CostSummary {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    const userCosts = [...this.costs.values()].filter(
      (c) => c.userId === userId && c.timestamp >= periodStart
    );

    const totalCost = userCosts.reduce((sum, c) => sum + c.costUsd, 0);
    const totalTokens = userCosts.reduce((sum, c) => sum + c.tokensUsed, 0);
    const operationsCount = userCosts.length;
    const averageCostPerOperation =
      operationsCount > 0 ? totalCost / operationsCount : 0;

    const byPeriod = new Map<CostPeriod, number>();

    for (const p of ["day", "week", "month", "year"] as CostPeriod[]) {
      byPeriod.set(p, this.getPeriodCost(userCosts, now, p));
    }

    const operationCosts = new Map<string, number>();
    userCosts.forEach((c) => {
      const current = operationCosts.get(c.operation) || 0;
      operationCosts.set(c.operation, current + c.costUsd);
    });

    return {
      totalCost,
      totalTokens,
      operationsCount,
      averageCostPerOperation,
      byPeriod,
      byOperation: operationCosts,
    };
  }

  checkBudget(userId: string): { withinBudget: boolean; budget?: Budget } {
    const budget = this.budgets.get(userId);
    if (!budget) {
      return { withinBudget: true };
    }

    const summary = this.getCostSummary(userId, budget.period);
    const periodCost = summary.byPeriod.get(budget.period) || 0;
    const percentageUsed = periodCost / budget.limitUsd;

    if (percentageUsed >= 1) {
      costTrackerMetrics.budgetAlerts.inc({ alert_type: "limit_exceeded" });
    } else if (percentageUsed >= budget.alertThreshold) {
      costTrackerMetrics.budgetAlerts.inc({ alert_type: "threshold_reached" });
    }

    return {
      withinBudget: percentageUsed < 1,
      budget,
    };
  }

  setBudget(
    userId: string,
    budget: Omit<Budget, "userId" | "createdAt" | "updatedAt">
  ) {
    const now = new Date();
    this.budgets.set(userId, {
      ...budget,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  private getPeriodStart(date: Date, period: CostPeriod): Date {
    const start = new Date(date);

    switch (period) {
      case "day": {
        return new Date(start.getFullYear(), start.getMonth(), start.getDate());
      }
      case "week": {
        start.setDate(start.getDate() - start.getDay());
        return start;
      }
      case "month": {
        return new Date(start.getFullYear(), start.getMonth(), 1);
      }
      case "year": {
        return new Date(start.getFullYear(), 0, 1);
      }
    }
  }

  private getPeriodCost(
    costs: CostEntry[],
    now: Date,
    period: CostPeriod
  ): number {
    const start = this.getPeriodStart(now, period);

    return costs
      .filter((c) => c.timestamp >= start)
      .reduce((sum, c) => sum + c.costUsd, 0);
  }

  cleanupOldEntries(olderThanMs: number = 30 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - olderThanMs;

    for (const [key, value] of this.costs.entries()) {
      if (value.timestamp.getTime() < cutoff) {
        this.costs.delete(key);
      }
    }
  }
}
