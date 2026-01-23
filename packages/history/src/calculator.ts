/**
 * Dynamic Budget Calculator
 *
 * Research-backed token budget allocation system that dynamically adjusts
 * based on model context windows, usage patterns, and cost constraints.
 *
 * Key research findings implemented:
 * - "Lost in the Middle" phenomenon: 55% utilization threshold for reliable retrieval
 * - Performance degradation above 85% utilization
 * - Critical info should be in first 20% (primacy) and last 10% (recency)
 * - Compression research: 80% pruning possible without significant degradation
 *
 * @module @alfred/history/calculator
 */

import {
  DEFAULT_MODEL_SPEC,
  getModelSpec,
  type ModelSpec,
} from "./registry";

// ============================================================================
// Research-Based Budget Ratios
// ============================================================================

/**
 * Budget ratio configuration based on research.
 *
 * Sources:
 * - "Lost in the Middle" (Liu et al., 2023): U-shaped retrieval curve
 * - Context Engineering Guide (2025): 70% warn, 85% hard cap
 * - LLMLingua: Coarse-to-fine compression with budget controller
 */
export const BUDGET_RATIOS = Object.freeze({
  // History allocation
  DEFAULT_HISTORY_RATIO: 0.55, // 55% - below retrieval degradation threshold
  MIN_HISTORY_RATIO: 0.15, // 15% - minimum viable conversation
  MAX_HISTORY_RATIO: 0.75, // 75% - safety margin from 85% cliff
  AGGRESSIVE_REDUCTION: 0.10, // 10% reduction when aggressive mode enabled

  // Reserve percentages (of total context)
  SYSTEM_RESERVE_RATIO: 0.08, // 8% - critical instructions in primacy zone
  HEADROOM_RATIO: 0.15, // 15% - response generation buffer
  TOOLING_RESERVE_RATIO: 0.06, // 6% - tool schemas, calls, results

  // Tier overdraft (of history budget)
  HIGH_TIER_OVERDRAFT_RATIO: 0.02, // 2% - user messages
  MEDIUM_TIER_OVERDRAFT_RATIO: 0.01, // 1% - assistant/tool messages

  // Warning thresholds (of total context)
  WARNING_THRESHOLD_RATIO: 0.04, // 4% - warn when remaining < this
  CRITICAL_THRESHOLD_RATIO: 0.01, // 1% - fail gracefully

  // Absolute minimums (for small context models)
  MIN_SYSTEM_RESERVE: 2_000,
  MIN_HEADROOM: 2_000,
  MIN_TOOLING_RESERVE: 1_000,
  MIN_HIGH_OVERDRAFT: 512,
  MIN_MEDIUM_OVERDRAFT: 256,
  MIN_WARNING_THRESHOLD: 1_000,
});

// ============================================================================
// Budget Types
// ============================================================================

import type { HistoryTier } from "./types";
export type { HistoryTier };

export type BudgetConfig = {
  /** Model ID for context window lookup */
  modelId: string;
  /** Override history ratio (0.15-0.75) */
  historyRatio?: number;
  /** Enable aggressive mode (reduces ratio by 10%) */
  aggressive?: boolean;
  /** Override max context tokens */
  maxContextTokens?: number;
  /** System prompt token count (if known) */
  systemTokens?: number;
  /** USD budget limit for this session */
  budgetUsd?: number;
  /** Use extended context if available */
  useExtendedContext?: boolean;
};

export type CalculatedBudget = {
  // Model info
  modelId: string;
  modelSpec: ModelSpec;

  // Context window
  maxContextTokens: number;
  effectiveContextTokens: number; // After extended context consideration

  // Budget allocations (tokens)
  systemReserveTokens: number;
  headroomTokens: number;
  toolingReserveTokens: number;
  historyBudgetTokens: number;

  // Tier overdraft allowances
  highTierOverdraft: number;
  mediumTierOverdraft: number;

  // Warning thresholds
  warningThreshold: number;
  criticalThreshold: number;

  // Ratios used
  historyRatio: number;
  effectiveUtilization: number;

  // Cost projections
  estimatedCostPerTurn: CostProjection;
};

export type CostProjection = {
  /** Minimum cost (system + small response) */
  minCostUsd: number;
  /** Typical cost (half context + medium response) */
  typicalCostUsd: number;
  /** Maximum cost (full context + max response) */
  maxCostUsd: number;
  /** Cost per 1k input tokens */
  inputCostPer1k: number;
  /** Cost per 1k output tokens */
  outputCostPer1k: number;
};

// ============================================================================
// Budget Calculator
// ============================================================================

/**
 * Calculate dynamic budget for a given model and configuration.
 */
export function calculateBudget(config: BudgetConfig): CalculatedBudget {
  const modelSpec = getModelSpec(config.modelId) ?? DEFAULT_MODEL_SPEC;

  // Determine effective context window
  const baseContextTokens =
    config.maxContextTokens ?? modelSpec.capabilities.maxContextTokens;

  const effectiveContextTokens =
    config.useExtendedContext && modelSpec.capabilities.extendedContext
      ? modelSpec.capabilities.extendedContext
      : baseContextTokens;

  // Calculate history ratio
  let historyRatio =
    config.historyRatio ?? modelSpec.recommendedHistoryRatio;

  if (config.aggressive) {
    historyRatio -= BUDGET_RATIOS.AGGRESSIVE_REDUCTION;
  }

  // Clamp history ratio
  historyRatio = Math.max(
    BUDGET_RATIOS.MIN_HISTORY_RATIO,
    Math.min(BUDGET_RATIOS.MAX_HISTORY_RATIO, historyRatio)
  );

  // Calculate reserve budgets (scaled to context window)
  const systemReserveTokens = Math.max(
    BUDGET_RATIOS.MIN_SYSTEM_RESERVE,
    Math.floor(effectiveContextTokens * BUDGET_RATIOS.SYSTEM_RESERVE_RATIO)
  );

  const headroomTokens = Math.max(
    BUDGET_RATIOS.MIN_HEADROOM,
    Math.floor(effectiveContextTokens * BUDGET_RATIOS.HEADROOM_RATIO)
  );

  const toolingReserveTokens = Math.max(
    BUDGET_RATIOS.MIN_TOOLING_RESERVE,
    Math.floor(effectiveContextTokens * BUDGET_RATIOS.TOOLING_RESERVE_RATIO)
  );

  // Calculate history budget
  const historyWindow = Math.floor(effectiveContextTokens * historyRatio);
  const systemTokens = config.systemTokens ?? systemReserveTokens;
  const totalReserve = Math.max(systemTokens, systemReserveTokens) + headroomTokens + toolingReserveTokens;
  const historyBudgetTokens = Math.max(0, historyWindow - totalReserve);

  // Calculate tier overdrafts (based on history budget)
  const highTierOverdraft = Math.max(
    BUDGET_RATIOS.MIN_HIGH_OVERDRAFT,
    Math.floor(historyBudgetTokens * BUDGET_RATIOS.HIGH_TIER_OVERDRAFT_RATIO)
  );

  const mediumTierOverdraft = Math.max(
    BUDGET_RATIOS.MIN_MEDIUM_OVERDRAFT,
    Math.floor(historyBudgetTokens * BUDGET_RATIOS.MEDIUM_TIER_OVERDRAFT_RATIO)
  );

  // Calculate warning thresholds
  const warningThreshold = Math.max(
    BUDGET_RATIOS.MIN_WARNING_THRESHOLD,
    Math.floor(effectiveContextTokens * BUDGET_RATIOS.WARNING_THRESHOLD_RATIO)
  );

  const criticalThreshold = Math.max(
    500,
    Math.floor(effectiveContextTokens * BUDGET_RATIOS.CRITICAL_THRESHOLD_RATIO)
  );

  // Calculate effective utilization
  const totalAllocated = systemReserveTokens + headroomTokens + toolingReserveTokens + historyBudgetTokens;
  const effectiveUtilization = totalAllocated / effectiveContextTokens;

  // Calculate cost projections
  const estimatedCostPerTurn = calculateCostProjection(
    modelSpec,
    systemReserveTokens,
    historyBudgetTokens,
    effectiveContextTokens
  );

  return {
    modelId: config.modelId,
    modelSpec,
    maxContextTokens: baseContextTokens,
    effectiveContextTokens,
    systemReserveTokens,
    headroomTokens,
    toolingReserveTokens,
    historyBudgetTokens,
    highTierOverdraft,
    mediumTierOverdraft,
    warningThreshold,
    criticalThreshold,
    historyRatio,
    effectiveUtilization,
    estimatedCostPerTurn,
  };
}

/**
 * Calculate cost projection for a turn.
 */
function calculateCostProjection(
  spec: ModelSpec,
  systemTokens: number,
  historyBudget: number,
  maxContext: number
): CostProjection {
  const inputCostPer1k = spec.pricing.inputPer1M / 1000;
  const outputCostPer1k = spec.pricing.outputPer1M / 1000;

  // Minimum: just system prompt + small response
  const minInputTokens = systemTokens;
  const minOutputTokens = 500;
  const minCostUsd =
    (minInputTokens * inputCostPer1k) / 1000 +
    (minOutputTokens * outputCostPer1k) / 1000;

  // Typical: half history budget + medium response
  const typicalInputTokens = systemTokens + historyBudget * 0.5;
  const typicalOutputTokens = Math.min(2000, spec.capabilities.maxOutputTokens * 0.25);
  const typicalCostUsd =
    (typicalInputTokens * inputCostPer1k) / 1000 +
    (typicalOutputTokens * outputCostPer1k) / 1000;

  // Maximum: full context + max response
  const maxInputTokens = maxContext * 0.85; // 85% utilization ceiling
  const maxOutputTokens = spec.capabilities.maxOutputTokens;
  const maxCostUsd =
    (maxInputTokens * inputCostPer1k) / 1000 +
    (maxOutputTokens * outputCostPer1k) / 1000;

  return {
    minCostUsd,
    typicalCostUsd,
    maxCostUsd,
    inputCostPer1k,
    outputCostPer1k,
  };
}

/**
 * Get allowed overdraft for a message tier.
 */
export function getAllowedOverdraft(
  tier: HistoryTier,
  budget: CalculatedBudget
): number {
  if (budget.historyBudgetTokens <= 0) {
    return 0;
  }

  switch (tier) {
    case "anchor":
      // Anchors always included, no overdraft concept
      return budget.historyBudgetTokens;
    case "high":
      return budget.highTierOverdraft;
    case "medium":
      return budget.mediumTierOverdraft;
    case "low":
      return 0;
  }
}

// ============================================================================
// Budget Presets
// ============================================================================

/**
 * Pre-calculated budget presets for common models.
 */
export const BUDGET_PRESETS: Record<string, CalculatedBudget> = {};

// Generate presets for common models on module load
const PRESET_MODELS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3-mini",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3-5-sonnet",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-v3",
];

for (const modelId of PRESET_MODELS) {
  BUDGET_PRESETS[modelId] = calculateBudget({ modelId });
}

// ============================================================================
// Budget Utilities
// ============================================================================

/**
 * Check if a budget is approaching limits.
 */
export function checkBudgetHealth(
  budget: CalculatedBudget,
  currentUsage: number
): {
  status: "healthy" | "warning" | "critical" | "exceeded";
  remainingTokens: number;
  utilizationPercent: number;
  message: string;
} {
  const remaining = budget.historyBudgetTokens - currentUsage;
  const utilizationPercent = (currentUsage / budget.historyBudgetTokens) * 100;

  if (remaining <= 0) {
    return {
      status: "exceeded",
      remainingTokens: 0,
      utilizationPercent: 100,
      message: `History budget exceeded by ${Math.abs(remaining)} tokens`,
    };
  }

  if (remaining < budget.criticalThreshold) {
    return {
      status: "critical",
      remainingTokens: remaining,
      utilizationPercent,
      message: `Critical: only ${remaining} tokens remaining`,
    };
  }

  if (remaining < budget.warningThreshold) {
    return {
      status: "warning",
      remainingTokens: remaining,
      utilizationPercent,
      message: `Warning: ${remaining} tokens remaining (${utilizationPercent.toFixed(1)}% used)`,
    };
  }

  return {
    status: "healthy",
    remainingTokens: remaining,
    utilizationPercent,
    message: `Healthy: ${remaining} tokens remaining`,
  };
}

/**
 * Estimate how many turns fit within budget.
 */
export function estimateTurnsRemaining(
  budget: CalculatedBudget,
  currentUsage: number,
  avgTokensPerTurn: number
): number {
  if (avgTokensPerTurn <= 0) {
    return Infinity;
  }
  const remaining = budget.historyBudgetTokens - currentUsage;
  return Math.max(0, Math.floor(remaining / avgTokensPerTurn));
}

/**
 * Calculate cost for a specific token usage.
 */
export function calculateUsageCost(
  budget: CalculatedBudget,
  inputTokens: number,
  outputTokens: number,
  cached = false
): number {
  const inputRate = cached && budget.modelSpec.pricing.cachedInputPer1M
    ? budget.modelSpec.pricing.cachedInputPer1M
    : budget.modelSpec.pricing.inputPer1M;

  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * budget.modelSpec.pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Format budget as human-readable summary.
 */
export function formatBudgetSummary(budget: CalculatedBudget): string {
  const formatK = (n: number) => `${(n / 1000).toFixed(1)}k`;
  const formatUsd = (n: number) => `$${n.toFixed(4)}`;

  return [
    `Model: ${budget.modelSpec.displayName}`,
    `Context Window: ${formatK(budget.effectiveContextTokens)} tokens`,
    ``,
    `Budget Allocation:`,
    `  System Reserve:  ${formatK(budget.systemReserveTokens)} (${((budget.systemReserveTokens / budget.effectiveContextTokens) * 100).toFixed(1)}%)`,
    `  Headroom:        ${formatK(budget.headroomTokens)} (${((budget.headroomTokens / budget.effectiveContextTokens) * 100).toFixed(1)}%)`,
    `  Tooling:         ${formatK(budget.toolingReserveTokens)} (${((budget.toolingReserveTokens / budget.effectiveContextTokens) * 100).toFixed(1)}%)`,
    `  History Budget:  ${formatK(budget.historyBudgetTokens)} (${((budget.historyBudgetTokens / budget.effectiveContextTokens) * 100).toFixed(1)}%)`,
    ``,
    `Overdraft Allowances:`,
    `  High Tier:   ${budget.highTierOverdraft} tokens`,
    `  Medium Tier: ${budget.mediumTierOverdraft} tokens`,
    ``,
    `Warning Thresholds:`,
    `  Warning:  < ${formatK(budget.warningThreshold)} remaining`,
    `  Critical: < ${formatK(budget.criticalThreshold)} remaining`,
    ``,
    `Cost Estimates (per turn):`,
    `  Minimum:  ${formatUsd(budget.estimatedCostPerTurn.minCostUsd)}`,
    `  Typical:  ${formatUsd(budget.estimatedCostPerTurn.typicalCostUsd)}`,
    `  Maximum:  ${formatUsd(budget.estimatedCostPerTurn.maxCostUsd)}`,
    ``,
    `Effective Utilization: ${(budget.effectiveUtilization * 100).toFixed(1)}%`,
  ].join("\n");
}
