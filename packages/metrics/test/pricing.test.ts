import { describe, expect, it } from "bun:test";

import { calculateCostUsd, getModelPricing } from "../src/pricing";

describe("Pricing Registry", () => {
  describe("getModelPricing", () => {
    it("returns correct pricing for known OpenAI models", () => {
      const pricing = getModelPricing("openai", "gpt-4o");
      expect(pricing.promptCostPer1M).toBe(2.5);
      expect(pricing.completionCostPer1M).toBe(10);
    });

    it("returns correct pricing for Cerebras models", () => {
      const pricing = getModelPricing("cerebras", "llama3.1-70b");
      expect(pricing.promptCostPer1M).toBe(0.6);
      expect(pricing.completionCostPer1M).toBe(0.6);
    });

    it("returns correct pricing for Cerebras llama3.1-8b (used in tests/examples)", () => {
      const pricing = getModelPricing("cerebras", "llama3.1-8b");
      expect(pricing.promptCostPer1M).toBe(0.1);
      expect(pricing.completionCostPer1M).toBe(0.1);
    });

    it("returns correct pricing for OpenRouter models", () => {
      const pricing = getModelPricing(
        "openrouter",
        "anthropic/claude-3.5-sonnet"
      );
      expect(pricing.promptCostPer1M).toBe(3);
      expect(pricing.completionCostPer1M).toBe(15);
    });

    it("handles model version prefixes for OpenAI", () => {
      // Should match "gpt-4o" prefix
      const pricing = getModelPricing("openai", "gpt-4o-2024-08-06");
      expect(pricing.promptCostPer1M).toBe(2.5);
      expect(pricing.completionCostPer1M).toBe(10);
    });

    it("falls back to default for unknown models", () => {
      const pricing = getModelPricing("openai", "unknown-model-xyz");
      expect(pricing.promptCostPer1M).toBe(1);
      expect(pricing.completionCostPer1M).toBe(3);
    });

    it("falls back to default for unknown providers", () => {
      const pricing = getModelPricing("unknown" as any, "some-model");
      expect(pricing.promptCostPer1M).toBe(1);
      expect(pricing.completionCostPer1M).toBe(3);
    });

    it("returns exact match over prefix match", () => {
      // If both "gpt-4" and "gpt-4o" exist, should prefer exact
      const pricing = getModelPricing("openai", "gpt-4o");
      expect(pricing.promptCostPer1M).toBe(2.5); // gpt-4o price, not gpt-4
    });
  });

  describe("calculateCostUsd", () => {
    it("calculates USD cost correctly for standard usage", () => {
      // 100k prompt tokens + 50k completion tokens
      // At $2.50 per 1M prompt, $10.00 per 1M completion
      const cost = calculateCostUsd("openai", "gpt-4o", 100_000, 50_000);
      expect(cost).toBeCloseTo(0.75, 2); // (100k/1M * 2.5) + (50k/1M * 10) = 0.25 + 0.5 = 0.75
    });

    it("handles zero tokens correctly", () => {
      const cost = calculateCostUsd("openai", "gpt-4o", 0, 0);
      expect(cost).toBe(0);
    });

    it("handles zero prompt tokens", () => {
      const cost = calculateCostUsd("openai", "gpt-4o", 0, 10_000);
      expect(cost).toBeCloseTo(0.1, 2); // 10k/1M * 10 = 0.1
    });

    it("handles zero completion tokens", () => {
      const cost = calculateCostUsd("openai", "gpt-4o", 10_000, 0);
      expect(cost).toBeCloseTo(0.025, 3); // 10k/1M * 2.5 = 0.025
    });

    it("handles very large token counts", () => {
      // 10M prompt tokens + 5M completion tokens
      const cost = calculateCostUsd("openai", "gpt-4o", 10_000_000, 5_000_000);
      expect(cost).toBeCloseTo(75, 1); // (10M/1M * 2.5) + (5M/1M * 10) = 25 + 50 = 75
    });

    it("handles fractional costs correctly", () => {
      // 1k tokens should give small fractional cost
      const cost = calculateCostUsd("openai", "gpt-4o-mini", 1000, 1000);
      expect(cost).toBeCloseTo(0.000_75, 5); // (1k/1M * 0.15) + (1k/1M * 0.6) = 0.00075
    });

    it("uses correct pricing for different providers", () => {
      const openaiCost = calculateCostUsd("openai", "gpt-4o", 100_000, 50_000);
      const cerebrasCost = calculateCostUsd(
        "cerebras",
        "llama3.1-8b",
        100_000,
        50_000
      );

      expect(openaiCost).toBeGreaterThan(cerebrasCost); // OpenAI more expensive
      expect(cerebrasCost).toBeCloseTo(0.015, 3); // (100k + 50k) / 1M * 0.1 = 0.015
    });

    it("uses default pricing for unknown models", () => {
      const cost = calculateCostUsd("openai", "unknown-model", 100_000, 50_000);
      expect(cost).toBeCloseTo(0.25, 2); // (100k/1M * 1) + (50k/1M * 3) = 0.1 + 0.15 = 0.25
    });
  });
});
