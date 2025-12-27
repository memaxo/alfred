/**
 * ALFRED Budget Manager
 * Enforces budget limits and tracks usage
 */

import { logger } from "@alfred/logger";
import { calculateCost, estimateCost, getCheaperAlternatives } from "./costs";

// Lazy import to avoid circular dependencies
let budgetRepo: typeof import("@alfred/db/repo/budget") | null = null;

async function getBudgetRepo() {
  if (!budgetRepo) {
    budgetRepo = await import("@alfred/db/repo/budget");
  }
  return budgetRepo;
}

// ============================================================================
// Types
// ============================================================================

export type ModelRole =
  | "chat"
  | "orchestrator"
  | "planner"
  | "background"
  | "voice"
  | "fast";

export type CostPriority = "minimize" | "balanced" | "maximize_quality";

export interface BudgetCheckResult {
  allowed: boolean;
  reason?:
    | "daily_dollar_exceeded"
    | "daily_token_exceeded"
    | "latency_constraint"
    | "request_token_limit";
  remaining?: {
    dollars: number;
    tokens: number;
    percentUsed: number;
  };
  suggestedModel?: string; // Cheaper alternative if budget tight
  warning?: string; // Warning message if approaching limit
}

export interface UsageRecord {
  modelRef: string;
  provider: string;
  role: ModelRole;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs?: number;
  workflowRunId?: string;
  conversationId?: string;
}

export interface DailyUsage {
  date: Date;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  totalCostCents: number;
  totalCostDollars: number;
  requestCount: number;
  blockedCount: number;
  providerBreakdown: Record<
    string,
    { inputTokens: number; outputTokens: number; costCents: number }
  >;
  roleBreakdown: Record<
    string,
    { inputTokens: number; outputTokens: number; costCents: number }
  >;
}

export interface UserBudgetSettings {
  dailyDollarLimit: number | null;
  dailyTokenLimit: number | null;
  maxLatencyMs: number | null;
  maxTokensPerRequest: number | null;
  modelPreferences: Record<ModelRole, string> | null;
  costPriority: CostPriority;
}

// ============================================================================
// Budget Manager Class
// ============================================================================

/**
 * Budget enforcement percentage thresholds
 */
const WARNING_THRESHOLD = 0.8; // Warn at 80% usage
const SUGGEST_CHEAPER_THRESHOLD = 0.9; // Suggest cheaper at 90%

/**
 * Default budget reserve for user requests (when processing idle tasks)
 */
const DEFAULT_RESERVE_PERCENT = 0.2; // Reserve 20% for user requests

export class BudgetManager {
  private userId: string;
  private settingsCache: UserBudgetSettings | null = null;
  private settingsCacheTime = 0;
  private readonly settingsCacheTtlMs = 60_000; // 1 minute

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get user's budget settings (with caching)
   */
  async getSettings(): Promise<UserBudgetSettings> {
    const now = Date.now();

    if (
      this.settingsCache &&
      now - this.settingsCacheTime < this.settingsCacheTtlMs
    ) {
      return this.settingsCache;
    }

    const repo = await getBudgetRepo();
    const budget = await repo.getUserBudget(this.userId);

    this.settingsCache = {
      dailyDollarLimit: budget?.dailyDollarLimit ?? null,
      dailyTokenLimit: budget?.dailyTokenLimit ?? null,
      maxLatencyMs: budget?.maxLatencyMs ?? null,
      maxTokensPerRequest: budget?.maxTokensPerRequest ?? null,
      modelPreferences:
        (budget?.modelPreferences as Record<ModelRole, string>) ?? null,
      costPriority: (budget?.costPriority as CostPriority) ?? "balanced",
    };
    this.settingsCacheTime = now;

    return this.settingsCache;
  }

  /**
   * Clear settings cache (call after updating settings)
   */
  clearSettingsCache(): void {
    this.settingsCache = null;
    this.settingsCacheTime = 0;
  }

  /**
   * Check if a request is within budget
   */
  async checkBudget(
    role: ModelRole,
    modelRef: string,
    estimatedTokens: number
  ): Promise<BudgetCheckResult> {
    const settings = await this.getSettings();
    const usage = await this.getDailyUsage();

    // Check per-request token limit
    if (
      settings.maxTokensPerRequest &&
      estimatedTokens > settings.maxTokensPerRequest
    ) {
      return {
        allowed: false,
        reason: "request_token_limit",
        remaining: this.calculateRemaining(settings, usage),
      };
    }

    // Check daily token limit
    if (settings.dailyTokenLimit) {
      const projectedTokens = usage.totalTokens + estimatedTokens;
      if (projectedTokens > settings.dailyTokenLimit) {
        const suggestedModel = this.suggestCheaperModel(
          modelRef,
          settings.costPriority
        );
        return {
          allowed: false,
          reason: "daily_token_exceeded",
          remaining: this.calculateRemaining(settings, usage),
          suggestedModel,
        };
      }
    }

    // Check daily dollar limit
    if (settings.dailyDollarLimit) {
      const estimatedCostCents = estimateCost(
        modelRef,
        estimatedTokens,
        estimatedTokens * 0.5
      );
      const projectedCostDollars =
        (usage.totalCostCents + estimatedCostCents) / 100;

      if (projectedCostDollars > settings.dailyDollarLimit) {
        const suggestedModel = this.suggestCheaperModel(
          modelRef,
          settings.costPriority
        );
        return {
          allowed: false,
          reason: "daily_dollar_exceeded",
          remaining: this.calculateRemaining(settings, usage),
          suggestedModel,
        };
      }
    }

    // Calculate remaining and check for warnings
    const remaining = this.calculateRemaining(settings, usage);
    let warning: string | undefined;
    let suggestedModel: string | undefined;

    if (remaining) {
      if (remaining.percentUsed >= SUGGEST_CHEAPER_THRESHOLD) {
        suggestedModel = this.suggestCheaperModel(
          modelRef,
          settings.costPriority
        );
        warning = `Budget ${Math.round(remaining.percentUsed * 100)}% used. Consider using ${suggestedModel ?? "a cheaper model"}.`;
      } else if (remaining.percentUsed >= WARNING_THRESHOLD) {
        warning = `Budget ${Math.round(remaining.percentUsed * 100)}% used.`;
      }
    }

    return {
      allowed: true,
      remaining,
      warning,
      suggestedModel,
    };
  }

  /**
   * Check if there's budget available for idle/background tasks
   */
  async checkIdleBudget(
    estimatedTokens: number,
    reservePercent: number = DEFAULT_RESERVE_PERCENT
  ): Promise<BudgetCheckResult> {
    const settings = await this.getSettings();
    const usage = await this.getDailyUsage();

    // Calculate available budget after reserve
    if (settings.dailyDollarLimit) {
      const reserveDollars = settings.dailyDollarLimit * reservePercent;
      const availableDollars = settings.dailyDollarLimit - reserveDollars;
      const usedDollars = usage.totalCostDollars;

      if (usedDollars >= availableDollars) {
        return {
          allowed: false,
          reason: "daily_dollar_exceeded",
          remaining: this.calculateRemaining(settings, usage),
        };
      }
    }

    if (settings.dailyTokenLimit) {
      const reserveTokens = settings.dailyTokenLimit * reservePercent;
      const availableTokens = settings.dailyTokenLimit - reserveTokens;

      if (usage.totalTokens >= availableTokens) {
        return {
          allowed: false,
          reason: "daily_token_exceeded",
          remaining: this.calculateRemaining(settings, usage),
        };
      }
    }

    return {
      allowed: true,
      remaining: this.calculateRemaining(settings, usage),
    };
  }

  /**
   * Record usage after a request completes
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    const repo = await getBudgetRepo();

    // Calculate cost
    const costCents = calculateCost(
      record.modelRef,
      record.inputTokens,
      record.outputTokens,
      record.cachedTokens
    );

    // Update daily aggregate
    await repo.incrementDailyUsage(this.userId, {
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cachedTokens: record.cachedTokens,
      costCents,
      provider: record.provider,
      role: record.role,
    });

    // Record detailed event
    await repo.recordUsageEvent({
      userId: this.userId,
      modelRef: record.modelRef,
      provider: record.provider,
      role: record.role,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cachedTokens: record.cachedTokens ?? 0,
      costCents,
      latencyMs: record.latencyMs,
      workflowRunId: record.workflowRunId,
      conversationId: record.conversationId,
    });

    logger.debug("budget_usage_recorded", {
      userId: this.userId,
      modelRef: record.modelRef,
      tokens: record.inputTokens + record.outputTokens,
      costCents,
    });
  }

  /**
   * Get daily usage for the user
   */
  async getDailyUsage(): Promise<DailyUsage> {
    const repo = await getBudgetRepo();
    const tracking = await repo.getDailyUsage(this.userId);

    if (!tracking) {
      return {
        date: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        totalCostCents: 0,
        totalCostDollars: 0,
        requestCount: 0,
        blockedCount: 0,
        providerBreakdown: {},
        roleBreakdown: {},
      };
    }

    const totalTokens =
      (tracking.inputTokens ?? 0) + (tracking.outputTokens ?? 0);

    return {
      date: tracking.date,
      inputTokens: tracking.inputTokens ?? 0,
      outputTokens: tracking.outputTokens ?? 0,
      cachedTokens: tracking.cachedTokens ?? 0,
      totalTokens,
      totalCostCents: tracking.totalCostCents ?? 0,
      totalCostDollars: (tracking.totalCostCents ?? 0) / 100,
      requestCount: tracking.requestCount ?? 0,
      blockedCount: tracking.blockedCount ?? 0,
      providerBreakdown:
        (tracking.providerBreakdown as Record<string, any>) ?? {},
      roleBreakdown: (tracking.roleBreakdown as Record<string, any>) ?? {},
    };
  }

  /**
   * Get usage history for multiple days
   */
  async getUsageHistory(days = 30): Promise<DailyUsage[]> {
    const repo = await getBudgetRepo();
    const history = await repo.getUsageHistory(this.userId, days);

    return history.map((tracking) => ({
      date: tracking.date,
      inputTokens: tracking.inputTokens ?? 0,
      outputTokens: tracking.outputTokens ?? 0,
      cachedTokens: tracking.cachedTokens ?? 0,
      totalTokens: (tracking.inputTokens ?? 0) + (tracking.outputTokens ?? 0),
      totalCostCents: tracking.totalCostCents ?? 0,
      totalCostDollars: (tracking.totalCostCents ?? 0) / 100,
      requestCount: tracking.requestCount ?? 0,
      blockedCount: tracking.blockedCount ?? 0,
      providerBreakdown:
        (tracking.providerBreakdown as Record<string, any>) ?? {},
      roleBreakdown: (tracking.roleBreakdown as Record<string, any>) ?? {},
    }));
  }

  /**
   * Suggest a cheaper model based on cost priority
   */
  suggestCheaperModel(
    currentModel: string,
    costPriority: CostPriority
  ): string | undefined {
    if (costPriority === "maximize_quality") {
      return; // Don't suggest cheaper models
    }

    const alternatives = getCheaperAlternatives(
      currentModel,
      costPriority === "minimize" ? 0.3 : 0.5
    );

    return alternatives[0];
  }

  /**
   * Get preferred model for a role
   */
  async getPreferredModel(role: ModelRole): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.modelPreferences?.[role] ?? null;
  }

  /**
   * Calculate remaining budget
   */
  private calculateRemaining(
    settings: UserBudgetSettings,
    usage: DailyUsage
  ): BudgetCheckResult["remaining"] {
    const dollarLimit = settings.dailyDollarLimit;
    const tokenLimit = settings.dailyTokenLimit;

    if (!(dollarLimit || tokenLimit)) {
      return;
    }

    const dollarRemaining = dollarLimit
      ? dollarLimit - usage.totalCostDollars
      : Number.MAX_SAFE_INTEGER;
    const tokenRemaining = tokenLimit
      ? tokenLimit - usage.totalTokens
      : Number.MAX_SAFE_INTEGER;

    // Calculate percent used based on whichever limit is tighter
    let percentUsed = 0;
    if (dollarLimit) {
      percentUsed = Math.max(percentUsed, usage.totalCostDollars / dollarLimit);
    }
    if (tokenLimit) {
      percentUsed = Math.max(percentUsed, usage.totalTokens / tokenLimit);
    }

    return {
      dollars: Math.max(0, dollarRemaining),
      tokens: Math.max(0, tokenRemaining),
      percentUsed: Math.min(1, percentUsed),
    };
  }
}

// ============================================================================
// Singleton instance per user (cached)
// ============================================================================

const managerCache = new Map<string, BudgetManager>();
const MANAGER_CACHE_SIZE = 100;

/**
 * Get budget manager for a user
 */
export function getBudgetManager(userId: string): BudgetManager {
  let manager = managerCache.get(userId);

  if (!manager) {
    // Evict oldest if at capacity
    if (managerCache.size >= MANAGER_CACHE_SIZE) {
      const firstKey = managerCache.keys().next().value;
      if (firstKey) managerCache.delete(firstKey);
    }

    manager = new BudgetManager(userId);
    managerCache.set(userId, manager);
  }

  return manager;
}

/**
 * Clear all cached managers
 */
export function clearBudgetManagerCache(): void {
  managerCache.clear();
}
