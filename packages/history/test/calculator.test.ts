import { describe, expect, it } from "bun:test";
import {
  BUDGET_RATIOS,
  calculateBudget,
  calculateUsageCost,
  checkBudgetHealth,
  estimateTurnsRemaining,
  formatBudgetSummary,
  getAllowedOverdraft,
} from "../src/calculator";

describe("Budget Calculator", () => {
  describe("calculateBudget", () => {
    it("scales reserves proportionally for 200k context models", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

      // Claude Sonnet 4: 200k context
      expect(budget.maxContextTokens).toBe(200_000);
      expect(budget.effectiveContextTokens).toBe(200_000);

      // System reserve: 8% of 200k = 16,000
      expect(budget.systemReserveTokens).toBe(16_000);

      // Headroom: 15% of 200k = 30,000
      expect(budget.headroomTokens).toBe(30_000);

      // Tooling: 6% of 200k = 12,000
      expect(budget.toolingReserveTokens).toBe(12_000);

      // History ratio: 0.55 (55%)
      expect(budget.historyRatio).toBe(0.55);
    });

    it("uses minimum reserves for small context models", () => {
      const budget = calculateBudget({ modelId: "deepseek/deepseek-v3" });

      // DeepSeek V3: 64k context
      expect(budget.maxContextTokens).toBe(64_000);

      // Should use calculated percentages since 8% of 64k = 5,120 > 2,000
      expect(budget.systemReserveTokens).toBe(5120);
      expect(budget.headroomTokens).toBe(9600);
      expect(budget.toolingReserveTokens).toBe(3840);
    });

    it("applies aggressive mode reduction", () => {
      const normal = calculateBudget({ modelId: "openai/gpt-4o" });
      const aggressive = calculateBudget({
        modelId: "openai/gpt-4o",
        aggressive: true,
      });

      // Aggressive reduces ratio by 0.1
      expect(aggressive.historyRatio).toBe(normal.historyRatio - 0.1);
    });

    it("clamps history ratio within valid bounds", () => {
      // Below minimum
      const tooLow = calculateBudget({
        modelId: "openai/gpt-4o",
        historyRatio: 0.01,
      });
      expect(tooLow.historyRatio).toBe(BUDGET_RATIOS.MIN_HISTORY_RATIO);

      // Above maximum
      const tooHigh = calculateBudget({
        modelId: "openai/gpt-4o",
        historyRatio: 0.99,
      });
      expect(tooHigh.historyRatio).toBe(BUDGET_RATIOS.MAX_HISTORY_RATIO);

      // Within bounds
      const valid = calculateBudget({
        modelId: "openai/gpt-4o",
        historyRatio: 0.6,
      });
      expect(valid.historyRatio).toBe(0.6);
    });

    it("uses extended context when requested", () => {
      const base = calculateBudget({ modelId: "anthropic/claude-opus-4.5" });
      const extended = calculateBudget({
        modelId: "anthropic/claude-opus-4.5",
        useExtendedContext: true,
      });

      expect(base.effectiveContextTokens).toBe(200_000);
      expect(extended.effectiveContextTokens).toBe(1_000_000);
    });

    it("calculates high tier overdraft correctly", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

      // High tier: 2% of history budget
      const expectedOverdraft = Math.floor(
        budget.historyBudgetTokens * BUDGET_RATIOS.HIGH_TIER_OVERDRAFT_RATIO
      );
      expect(budget.highTierOverdraft).toBeGreaterThanOrEqual(
        BUDGET_RATIOS.MIN_HIGH_OVERDRAFT
      );
      expect(budget.highTierOverdraft).toBeCloseTo(expectedOverdraft, -2);
    });

    it("calculates medium tier overdraft correctly", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

      // Medium tier: 1% of history budget
      const expectedOverdraft = Math.floor(
        budget.historyBudgetTokens * BUDGET_RATIOS.MEDIUM_TIER_OVERDRAFT_RATIO
      );
      expect(budget.mediumTierOverdraft).toBeGreaterThanOrEqual(
        BUDGET_RATIOS.MIN_MEDIUM_OVERDRAFT
      );
      expect(budget.mediumTierOverdraft).toBeCloseTo(expectedOverdraft, -2);
    });

    it("calculates warning thresholds", () => {
      const budget = calculateBudget({ modelId: "openai/gpt-4o" });

      // Warning: 4% of context
      expect(budget.warningThreshold).toBe(
        Math.floor(128_000 * BUDGET_RATIOS.WARNING_THRESHOLD_RATIO)
      );

      // Critical: 1% of context
      expect(budget.criticalThreshold).toBe(
        Math.floor(128_000 * BUDGET_RATIOS.CRITICAL_THRESHOLD_RATIO)
      );
    });

    it("produces reasonable effective utilization", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

      // Should be between 60-75% (below 85% cliff)
      expect(budget.effectiveUtilization).toBeGreaterThan(0.6);
      expect(budget.effectiveUtilization).toBeLessThan(0.8);
    });

    it("handles reasoning models with lower ratios", () => {
      const o1 = calculateBudget({ modelId: "openai/o1" });
      const o3 = calculateBudget({ modelId: "openai/o3" });
      const gpt4o = calculateBudget({ modelId: "openai/gpt-4o" });

      expect(o1.historyRatio).toBe(0.45);
      expect(o3.historyRatio).toBe(0.45);
      expect(gpt4o.historyRatio).toBe(0.55);
    });
  });

  describe("getAllowedOverdraft", () => {
    const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

    it("returns full budget for anchor tier", () => {
      const overdraft = getAllowedOverdraft("anchor", budget);
      expect(overdraft).toBe(budget.historyBudgetTokens);
    });

    it("returns high tier overdraft", () => {
      const overdraft = getAllowedOverdraft("high", budget);
      expect(overdraft).toBe(budget.highTierOverdraft);
    });

    it("returns medium tier overdraft", () => {
      const overdraft = getAllowedOverdraft("medium", budget);
      expect(overdraft).toBe(budget.mediumTierOverdraft);
    });

    it("returns zero for low tier", () => {
      const overdraft = getAllowedOverdraft("low", budget);
      expect(overdraft).toBe(0);
    });
  });

  describe("checkBudgetHealth", () => {
    const budget = calculateBudget({ modelId: "openai/gpt-4o" });
    const historyBudget = budget.historyBudgetTokens;

    it("returns healthy status with low usage", () => {
      const health = checkBudgetHealth(budget, historyBudget * 0.3);
      expect(health.status).toBe("healthy");
      expect(health.remainingTokens).toBeGreaterThan(budget.warningThreshold);
    });

    it("returns warning status near threshold", () => {
      const usage = historyBudget - budget.warningThreshold + 100;
      const health = checkBudgetHealth(budget, usage);
      expect(health.status).toBe("warning");
      expect(health.remainingTokens).toBeLessThan(budget.warningThreshold);
      expect(health.remainingTokens).toBeGreaterThan(budget.criticalThreshold);
    });

    it("returns critical status near critical threshold", () => {
      const usage = historyBudget - budget.criticalThreshold + 50;
      const health = checkBudgetHealth(budget, usage);
      expect(health.status).toBe("critical");
      expect(health.remainingTokens).toBeLessThan(budget.criticalThreshold);
    });

    it("returns exceeded status when over budget", () => {
      const health = checkBudgetHealth(budget, historyBudget + 1000);
      expect(health.status).toBe("exceeded");
      expect(health.remainingTokens).toBe(0);
      expect(health.utilizationPercent).toBe(100);
    });

    it("calculates utilization percentage correctly", () => {
      const usage = historyBudget * 0.6;
      const health = checkBudgetHealth(budget, usage);
      expect(health.utilizationPercent).toBeCloseTo(60, 0);
    });
  });

  describe("estimateTurnsRemaining", () => {
    const budget = calculateBudget({ modelId: "openai/gpt-4o" });

    it("estimates turns with typical usage", () => {
      const currentUsage = 10_000;
      const avgPerTurn = 5000;
      const remaining = estimateTurnsRemaining(
        budget,
        currentUsage,
        avgPerTurn
      );

      const expectedRemaining = Math.floor(
        (budget.historyBudgetTokens - currentUsage) / avgPerTurn
      );
      expect(remaining).toBe(expectedRemaining);
    });

    it("returns zero when budget exhausted", () => {
      const remaining = estimateTurnsRemaining(
        budget,
        budget.historyBudgetTokens + 1000,
        5000
      );
      expect(remaining).toBe(0);
    });

    it("returns infinity for zero average", () => {
      const remaining = estimateTurnsRemaining(budget, 0, 0);
      expect(remaining).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe("calculateUsageCost", () => {
    const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });

    it("calculates cost for non-cached usage", () => {
      const cost = calculateUsageCost(budget, 10_000, 2000, false);

      // Claude Sonnet 4: $3/M input, $15/M output
      const expectedCost =
        (10_000 / 1_000_000) * 3.0 + (2000 / 1_000_000) * 15.0;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it("applies cached discount", () => {
      const uncached = calculateUsageCost(budget, 10_000, 2000, false);
      const cached = calculateUsageCost(budget, 10_000, 2000, true);

      // Cached should be cheaper (10x discount: $0.3/M vs $3/M)
      expect(cached).toBeLessThan(uncached);

      // Cached input cost: (10,000 / 1M) * 0.3 = 0.003
      // Output cost: (2,000 / 1M) * 15 = 0.03
      // Total: 0.033
      expect(cached).toBeCloseTo(0.033, 4);
    });

    it("handles models without cached pricing", () => {
      const deepseekBudget = calculateBudget({
        modelId: "deepseek/deepseek-v3",
      });
      const cost = calculateUsageCost(deepseekBudget, 10_000, 2000, true);

      // Should still calculate (uses cached rate or falls back)
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("formatBudgetSummary", () => {
    it("formats budget as human-readable text", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });
      const summary = formatBudgetSummary(budget);

      expect(summary).toContain("Model: Claude Sonnet 4");
      expect(summary).toContain("Context Window:");
      expect(summary).toContain("System Reserve:");
      expect(summary).toContain("Headroom:");
      expect(summary).toContain("History Budget:");
      expect(summary).toContain("Cost Estimates");
    });

    it("includes all budget sections", () => {
      const budget = calculateBudget({ modelId: "openai/gpt-4o" });
      const summary = formatBudgetSummary(budget);

      expect(summary).toContain("Budget Allocation:");
      expect(summary).toContain("Overdraft Allowances:");
      expect(summary).toContain("Warning Thresholds:");
      expect(summary).toContain("Effective Utilization:");
    });
  });

  describe("Cost Projections", () => {
    it("projects reasonable cost ranges", () => {
      const budget = calculateBudget({ modelId: "anthropic/claude-sonnet-4" });
      const { minCostUsd, typicalCostUsd, maxCostUsd } =
        budget.estimatedCostPerTurn;

      // Min < typical < max
      expect(minCostUsd).toBeLessThan(typicalCostUsd);
      expect(typicalCostUsd).toBeLessThan(maxCostUsd);

      // All non-negative
      expect(minCostUsd).toBeGreaterThanOrEqual(0);
      expect(typicalCostUsd).toBeGreaterThanOrEqual(0);
      expect(maxCostUsd).toBeGreaterThanOrEqual(0);

      // Typical should be in reasonable range for Claude Sonnet 4
      // ~50k input tokens * $3/M + 2k output * $15/M = ~0.18 USD
      expect(typicalCostUsd).toBeGreaterThan(0.1);
      expect(typicalCostUsd).toBeLessThan(1.0);
    });

    it("calculates per-1k rates correctly", () => {
      const budget = calculateBudget({ modelId: "openai/gpt-4o" });
      const { inputCostPer1k, outputCostPer1k } = budget.estimatedCostPerTurn;

      // GPT-4o: $2.5/M input = $0.0025/1k
      expect(inputCostPer1k).toBeCloseTo(0.0025, 6);

      // GPT-4o: $10/M output = $0.01/1k
      expect(outputCostPer1k).toBeCloseTo(0.01, 6);
    });
  });

  describe("Budget Scaling Scenarios", () => {
    it("handles very large context models (1M+ tokens)", () => {
      const budget = calculateBudget({ modelId: "google/gemini-2.5-pro" });

      expect(budget.maxContextTokens).toBe(1_000_000);

      // System reserve: 8% = 80k
      expect(budget.systemReserveTokens).toBe(80_000);

      // Headroom: 15% = 150k
      expect(budget.headroomTokens).toBe(150_000);

      // History budget should be substantial
      expect(budget.historyBudgetTokens).toBeGreaterThan(400_000);
    });

    it("handles small context models (64k tokens)", () => {
      const budget = calculateBudget({ modelId: "deepseek/deepseek-v3" });

      expect(budget.maxContextTokens).toBe(64_000);

      // Should still get reasonable allocations
      expect(budget.historyBudgetTokens).toBeGreaterThan(20_000);
    });

    it("maintains effective utilization below 85% threshold", () => {
      const models = [
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4",
        "google/gemini-2.5-pro",
        "deepseek/deepseek-v3",
      ];

      for (const modelId of models) {
        const budget = calculateBudget({ modelId });

        // Research shows degradation at 85% utilization
        expect(budget.effectiveUtilization).toBeLessThan(0.85);
        expect(budget.effectiveUtilization).toBeGreaterThan(0.5);
      }
    });
  });

  describe("Override Handling", () => {
    it("respects maxContextTokens override", () => {
      const budget = calculateBudget({
        modelId: "openai/gpt-4o",
        maxContextTokens: 256_000,
      });

      expect(budget.maxContextTokens).toBe(256_000);
      expect(budget.effectiveContextTokens).toBe(256_000);
    });

    it("respects historyRatio override", () => {
      const budget = calculateBudget({
        modelId: "openai/gpt-4o",
        historyRatio: 0.7,
      });

      expect(budget.historyRatio).toBe(0.7);
    });

    it("respects systemTokens override", () => {
      const budget = calculateBudget({
        modelId: "openai/gpt-4o",
        systemTokens: 25_000,
      });

      // System reserve should be at least the provided value
      expect(budget.systemReserveTokens).toBeGreaterThanOrEqual(25_000);
    });
  });

  describe("Edge Cases", () => {
    it("handles unknown model with fallback", () => {
      const budget = calculateBudget({ modelId: "unknown/fake-model" });

      // Should use DEFAULT_MODEL_SPEC
      expect(budget.maxContextTokens).toBe(128_000);
      expect(budget.historyRatio).toBe(0.55);
    });

    it("handles zero history budget gracefully", () => {
      const budget = calculateBudget({
        modelId: "openai/gpt-4o",
        historyRatio: 0.01,
        systemTokens: 120_000,
      });

      // History budget should be zero or minimal
      expect(budget.historyBudgetTokens).toBeGreaterThanOrEqual(0);
    });

    it("warning threshold never exceeds history budget", () => {
      const models = listModels();
      for (const model of models) {
        const budget = calculateBudget({ modelId: model.id });
        expect(budget.warningThreshold).toBeLessThanOrEqual(
          budget.historyBudgetTokens
        );
      }
    });
  });
});

// Helper to import listModels for iteration tests
import { listModels } from "../src/registry";
