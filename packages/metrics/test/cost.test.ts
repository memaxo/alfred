import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  checkBudget,
  clearRunCosts,
  getRunCostSummary,
  getTrackedRuns,
  recordCost,
} from "../src/cost";

describe("Cost Tracking", () => {
  beforeEach(() => {
    // Clear all run costs before each test
    for (const runId of getTrackedRuns()) {
      clearRunCosts(runId);
    }
  });

  afterEach(() => {
    // Cleanup after each test
    for (const runId of getTrackedRuns()) {
      clearRunCosts(runId);
    }
  });

  describe("recordCost", () => {
    it("records cost with correct provider and tokens", () => {
      const runId = "test-run-1";
      const costUsd = recordCost("openai", "gpt-4o", 100_000, 50_000, runId);

      expect(costUsd).toBeGreaterThan(0);
      expect(costUsd).toBeCloseTo(0.75, 2);

      const summary = getRunCostSummary(runId);
      expect(summary.totalCostUsd).toBe(costUsd);
      expect(summary.totalPromptTokens).toBe(100_000);
      expect(summary.totalCompletionTokens).toBe(50_000);
    });

    it("aggregates costs per run", () => {
      const runId = "test-run-2";

      const cost1 = recordCost("openai", "gpt-4o", 50_000, 25_000, runId);
      const cost2 = recordCost("openai", "gpt-4o-mini", 10_000, 5000, runId);

      const summary = getRunCostSummary(runId);
      expect(summary.totalCostUsd).toBeCloseTo(cost1 + cost2, 4);
      expect(summary.totalPromptTokens).toBe(60_000);
      expect(summary.totalCompletionTokens).toBe(30_000);
      expect(summary.entries).toHaveLength(2);
    });

    it("keeps costs separated by run", () => {
      recordCost("openai", "gpt-4o", 100_000, 50_000, "run-1");
      recordCost("openai", "gpt-4o", 200_000, 100_000, "run-2");

      const summary1 = getRunCostSummary("run-1");
      const summary2 = getRunCostSummary("run-2");

      expect(summary1.totalPromptTokens).toBe(100_000);
      expect(summary2.totalPromptTokens).toBe(200_000);
      expect(summary1.totalCostUsd).not.toBe(summary2.totalCostUsd);
    });

    it("stores entry with timestamp", () => {
      const runId = "test-run-timestamp";
      const before = Date.now();
      recordCost("openai", "gpt-4o", 10_000, 5000, runId);
      const after = Date.now();

      const summary = getRunCostSummary(runId);
      expect(summary.entries).toHaveLength(1);
      const entry = summary.entries[0];
      expect(entry?.timestamp).toBeInstanceOf(Date);
      expect(entry?.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(entry?.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe("getRunCostSummary", () => {
    it("returns zero costs for non-existent run", () => {
      const summary = getRunCostSummary("non-existent-run");

      expect(summary.runId).toBe("non-existent-run");
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.totalPromptTokens).toBe(0);
      expect(summary.totalCompletionTokens).toBe(0);
      expect(summary.entries).toHaveLength(0);
    });

    it("includes all entries for a run", () => {
      const runId = "test-run-entries";
      recordCost("openai", "gpt-4o", 10_000, 5000, runId);
      recordCost("cerebras", "llama3.1-8b", 20_000, 10_000, runId);
      recordCost(
        "openrouter",
        "anthropic/claude-3.5-sonnet",
        5000,
        2500,
        runId
      );

      const summary = getRunCostSummary(runId);
      expect(summary.entries).toHaveLength(3);

      const providers = summary.entries.map((e) => e.provider);
      expect(providers).toContain("openai");
      expect(providers).toContain("cerebras");
      expect(providers).toContain("openrouter");
    });
  });

  describe("checkBudget", () => {
    it("detects when budget is approaching (90%)", () => {
      const runId = "test-run-approaching";
      const budget = 1.0; // $1 budget

      // Record $0.95 in costs (95%)
      recordCost("openai", "gpt-4o", 380_000, 0, runId); // ~$0.95

      const status = checkBudget(runId, budget);
      expect(status.approaching).toBe(true);
      expect(status.exceeded).toBe(false);
      expect(status.costUsd).toBeGreaterThan(0.9);
      expect(status.budgetUsd).toBe(budget);
    });

    it("detects when budget is exceeded (100%)", () => {
      const runId = "test-run-exceeded";
      const budget = 0.5; // $0.50 budget

      // Record $0.75 in costs (150%)
      recordCost("openai", "gpt-4o", 300_000, 0, runId); // ~$0.75

      const status = checkBudget(runId, budget);
      expect(status.exceeded).toBe(true);
      expect(status.approaching).toBe(true); // Also approaching since exceeded implies approaching
      expect(status.costUsd).toBeGreaterThan(budget);
    });

    it("returns false when well under budget", () => {
      const runId = "test-run-under";
      const budget = 10.0; // $10 budget

      recordCost("openai", "gpt-4o-mini", 10_000, 5000, runId); // ~$0.004

      const status = checkBudget(runId, budget);
      expect(status.approaching).toBe(false);
      expect(status.exceeded).toBe(false);
      expect(status.costUsd).toBeLessThan(budget * 0.9);
    });

    it("handles zero budget edge case", () => {
      const runId = "test-run-zero-budget";
      recordCost("openai", "gpt-4o", 1000, 500, runId);

      const status = checkBudget(runId, 0);
      expect(status.exceeded).toBe(true);
      expect(status.costUsd).toBeGreaterThan(0);
    });

    it("handles no costs recorded", () => {
      const status = checkBudget("no-costs-run", 1.0);

      expect(status.approaching).toBe(false);
      expect(status.exceeded).toBe(false);
      expect(status.costUsd).toBe(0);
    });
  });

  describe("clearRunCosts", () => {
    it("removes run from tracking", () => {
      const runId = "test-run-clear";
      recordCost("openai", "gpt-4o", 10_000, 5000, runId);

      expect(getTrackedRuns()).toContain(runId);

      clearRunCosts(runId);

      expect(getTrackedRuns()).not.toContain(runId);
      const summary = getRunCostSummary(runId);
      expect(summary.entries).toHaveLength(0);
    });

    it("handles clearing non-existent run", () => {
      expect(() => clearRunCosts("non-existent")).not.toThrow();
    });
  });

  describe("getTrackedRuns", () => {
    it("returns empty array when no runs tracked", () => {
      const runs = getTrackedRuns();
      expect(runs).toHaveLength(0);
    });

    it("returns all tracked run IDs", () => {
      recordCost("openai", "gpt-4o", 1000, 500, "run-a");
      recordCost("openai", "gpt-4o", 1000, 500, "run-b");
      recordCost("openai", "gpt-4o", 1000, 500, "run-c");

      const runs = getTrackedRuns();
      expect(runs).toHaveLength(3);
      expect(runs).toContain("run-a");
      expect(runs).toContain("run-b");
      expect(runs).toContain("run-c");
    });
  });
});
