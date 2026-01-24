import { beforeEach, describe, expect, it } from "bun:test";

import {
  UsageTracker,
  getOrCreateTracker,
  getTracker,
  removeTracker,
  getActiveSessions,
  getAggregateStats,
  getTrackingRegistry,
} from "../src/tracking";

describe("Usage Tracker", () => {
  beforeEach(() => {
    // Clean up all trackers between tests
    const sessions = getActiveSessions();
    for (const sessionId of sessions) {
      removeTracker(sessionId);
    }
  });

  describe("UsageTracker.record", () => {
    it("calculates cost correctly for standard models", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-1",
      });

      const record = tracker.record({
        inputTokens: 10_000,
        latencyMs: 500,
        modelId: "openai/gpt-4o",
        outputTokens: 2_000,
      });

      // GPT-4o: $2.5/M input, $10/M output
      // Cost: (10k/1M)*2.5 + (2k/1M)*10 = 0.025 + 0.02 = 0.045
      expect(record.costUsd).toBeCloseTo(0.045, 4);
      expect(record.inputTokens).toBe(10_000);
      expect(record.outputTokens).toBe(2000);
    });

    it("applies cached token discount", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "anthropic/claude-sonnet-4",
        sessionId: "test-2",
      });

      const uncached = tracker.record({
        inputTokens: 10_000,
        latencyMs: 500,
        modelId: "anthropic/claude-sonnet-4",
        outputTokens: 2_000,
      });

      const cached = tracker.record({
        cachedTokens: 8_000,
        inputTokens: 10_000,
        latencyMs: 500,
        modelId: "anthropic/claude-sonnet-4",
        outputTokens: 2_000,
      });

      // Cached should be cheaper
      expect(cached.costUsd).toBeLessThan(uncached.costUsd);
    });

    it("handles reasoning tokens for o1/R1 models", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/o1",
        sessionId: "test-3",
      });

      const record = tracker.record({
        inputTokens: 5_000,
        latencyMs: 2000,
        modelId: "openai/o1",
        outputTokens: 1_000,
        reasoningTokens: 3_000,
      });

      // o1: $15/M input, $60/M output, $60/M reasoning
      // Cost: (5k/1M)*15 + (1k/1M)*60 + (3k/1M)*60 = 0.075 + 0.06 + 0.18 = 0.315
      expect(record.costUsd).toBeCloseTo(0.315, 4);
      expect(record.reasoningTokens).toBe(3000);
    });

    it("tracks multiple records per session", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-4",
      });

      tracker.record({
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
      });

      tracker.record({
        inputTokens: 3_000,
        latencyMs: 200,
        modelId: "openai/gpt-4o",
        outputTokens: 500,
      });

      const summary = tracker.getSummary();
      expect(summary.totalInputTokens).toBe(8000);
      expect(summary.totalOutputTokens).toBe(1500);
      expect(summary.turnCount).toBe(2);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it("updates model breakdown correctly", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-5",
      });

      tracker.record({
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
      });

      tracker.record({
        inputTokens: 3_000,
        latencyMs: 200,
        modelId: "anthropic/claude-sonnet-4",
        outputTokens: 500,
      });

      const summary = tracker.getSummary();
      expect(summary.modelBreakdown.size).toBe(2);

      const gpt4oUsage = summary.modelBreakdown.get("openai/gpt-4o");
      expect(gpt4oUsage).toBeDefined();
      expect(gpt4oUsage?.turnCount).toBe(1);

      const claudeUsage = summary.modelBreakdown.get(
        "anthropic/claude-sonnet-4"
      );
      expect(claudeUsage).toBeDefined();
      expect(claudeUsage?.turnCount).toBe(1);
    });
  });

  describe("getBudgetStatus", () => {
    it("returns healthy status initially", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-6",
      });

      const status = tracker.getBudgetStatus();
      expect(status.status).toBe("healthy");
      expect(status.usedUsd).toBe(0);
      expect(status.remainingUsd).toBe(10);
      expect(status.percentUsed).toBe(0);
    });

    it("returns warning status at 75%", () => {
      const tracker = new UsageTracker({
        budgetUsd: 1.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-7",
      });

      // Record enough to hit 75% threshold
      // GPT-4o: $2.5/M input, $10/M output
      // Need ~$0.75 total
      // Input cost: (300k / 1M) * 2.5 = $0.75
      tracker.record({
        inputTokens: 300_000,
        latencyMs: 100,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      const status = tracker.getBudgetStatus();
      expect(status.status).toBe("warning");
      expect(status.percentUsed).toBeGreaterThanOrEqual(75);
    });

    it("returns critical status at 90%", () => {
      const tracker = new UsageTracker({
        budgetUsd: 1.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-8",
      });

      // Record enough to hit 90% threshold
      // GPT-4o: $2.5/M input
      // Need >$0.90 total (use 91% to ensure we exceed threshold)
      // Input cost: (364k / 1M) * 2.5 = $0.91
      tracker.record({
        inputTokens: 364_000,
        latencyMs: 100,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      const status = tracker.getBudgetStatus();
      expect(status.status).toBe("critical");
      expect(status.percentUsed).toBeGreaterThanOrEqual(90);
    });

    it("returns exceeded status at 100%", () => {
      const tracker = new UsageTracker({
        budgetUsd: 0.1,
        modelId: "openai/gpt-4o",
        sessionId: "test-9",
      });

      // Record enough to exceed budget
      tracker.record({
        inputTokens: 50_000,
        latencyMs: 100,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      const status = tracker.getBudgetStatus();
      expect(status.status).toBe("exceeded");
      expect(status.percentUsed).toBeGreaterThanOrEqual(100);
      expect(status.remainingUsd).toBeLessThanOrEqual(0);
    });

    it("estimates turns remaining", () => {
      const tracker = new UsageTracker({
        budgetUsd: 1.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-10",
      });

      tracker.record({
        inputTokens: 10_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 2_000,
      });

      const status = tracker.getBudgetStatus();
      expect(status.projectedTurnsRemaining).toBeGreaterThan(0);
      expect(Number.isFinite(status.projectedTurnsRemaining)).toBe(true);
    });

    it("handles infinite budget", () => {
      const tracker = new UsageTracker({
        budgetUsd: Infinity,
        modelId: "openai/gpt-4o",
        sessionId: "test-11",
      });

      const status = tracker.getBudgetStatus();
      expect(status.budgetUsd).toBe(Infinity);
      expect(status.status).toBe("healthy");
      expect(status.percentUsed).toBe(0);
    });
  });

  describe("wouldExceedBudget", () => {
    it("predicts budget exhaustion correctly", () => {
      const tracker = new UsageTracker({
        budgetUsd: 0.1,
        modelId: "openai/gpt-4o",
        sessionId: "test-12",
      });

      tracker.record({
        inputTokens: 20_000,
        latencyMs: 100,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      // Estimate cost for another 30k tokens
      const projectedCost = tracker.estimateCost({
        inputTokens: 30_000,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      const wouldExceed = tracker.wouldExceedBudget(projectedCost);
      expect(wouldExceed).toBe(true);
    });

    it("returns false when budget has room", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-13",
      });

      const projectedCost = tracker.estimateCost({
        inputTokens: 10_000,
        modelId: "openai/gpt-4o",
        outputTokens: 2_000,
      });

      const wouldExceed = tracker.wouldExceedBudget(projectedCost);
      expect(wouldExceed).toBe(false);
    });
  });

  describe("getSummary", () => {
    it("aggregates all usage correctly", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-14",
      });

      tracker.record({
        cachedTokens: 2_000,
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
        reasoningTokens: 0,
      });

      tracker.record({
        cachedTokens: 1_000,
        inputTokens: 3_000,
        latencyMs: 200,
        modelId: "openai/gpt-4o",
        outputTokens: 500,
        reasoningTokens: 0,
      });

      const summary = tracker.getSummary();
      expect(summary.totalInputTokens).toBe(8000);
      expect(summary.totalOutputTokens).toBe(1500);
      expect(summary.totalCachedTokens).toBe(3000);
      expect(summary.totalReasoningTokens).toBe(0);
      expect(summary.turnCount).toBe(2);
      expect(summary.avgLatencyMs).toBe(250);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it("includes budget status in summary", () => {
      const tracker = new UsageTracker({
        budgetUsd: 1.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-15",
      });

      const summary = tracker.getSummary();
      expect(summary.budgetStatus).toBeDefined();
      expect(summary.budgetStatus.budgetUsd).toBe(1);
      expect(summary.budgetStatus.status).toBe("healthy");
    });
  });

  describe("formatSummary", () => {
    it("formats summary as readable text", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "test-16",
      });

      tracker.record({
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
      });

      const formatted = tracker.formatSummary();
      expect(formatted).toContain("Session: test-16");
      expect(formatted).toContain("Turns: 1");
      expect(formatted).toContain("Input:");
      expect(formatted).toContain("Output:");
      expect(formatted).toContain("Cost:");
    });
  });

  describe("Tracker Registry", () => {
    it("getOrCreateTracker creates new tracker", () => {
      const tracker = getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-1",
      });

      expect(tracker).toBeInstanceOf(UsageTracker);
      expect(tracker.sessionId).toBe("registry-test-1");
    });

    it("getOrCreateTracker returns existing tracker", () => {
      const tracker1 = getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-2",
      });

      const tracker2 = getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-2",
      });

      expect(tracker1).toBe(tracker2);
    });

    it("getTracker returns existing tracker", () => {
      getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-3",
      });

      const tracker = getTracker("registry-test-3");
      expect(tracker).toBeDefined();
      expect(tracker?.sessionId).toBe("registry-test-3");
    });

    it("getTracker returns undefined for non-existent session", () => {
      const tracker = getTracker("non-existent");
      expect(tracker).toBeUndefined();
    });

    it("removeTracker removes tracker", () => {
      getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-4",
      });

      expect(getTracker("registry-test-4")).toBeDefined();
      removeTracker("registry-test-4");
      expect(getTracker("registry-test-4")).toBeUndefined();
    });

    it("getActiveSessions returns all active sessions", () => {
      getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "registry-test-5",
      });

      getOrCreateTracker({
        budgetUsd: 5.0,
        modelId: "anthropic/claude-sonnet-4",
        sessionId: "registry-test-6",
      });

      const sessions = getActiveSessions();
      expect(sessions).toContain("registry-test-5");
      expect(sessions).toContain("registry-test-6");
    });
  });

  describe("getAggregateStats", () => {
    it("aggregates stats across all sessions", () => {
      const tracker1 = getOrCreateTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "aggregate-test-1",
      });

      const tracker2 = getOrCreateTracker({
        budgetUsd: 5.0,
        modelId: "anthropic/claude-sonnet-4",
        sessionId: "aggregate-test-2",
      });

      tracker1.record({
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
      });

      tracker2.record({
        inputTokens: 3_000,
        latencyMs: 200,
        modelId: "anthropic/claude-sonnet-4",
        outputTokens: 500,
      });

      const stats = getAggregateStats();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalInputTokens).toBe(8000);
      expect(stats.totalOutputTokens).toBe(1500);
      expect(stats.totalTurns).toBe(2);
      expect(stats.totalCostUsd).toBeGreaterThan(0);
    });
  });

  describe("Prometheus Metrics Integration", () => {
    it("exposes tracking registry", () => {
      const registry = getTrackingRegistry();
      expect(registry).toBeDefined();
    });

    it("tracks metrics on record", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "metrics-test-1",
        verbose: false,
      });

      tracker.record({
        inputTokens: 5_000,
        latencyMs: 300,
        modelId: "openai/gpt-4o",
        outputTokens: 1_000,
      });

      // Metrics should be updated (we can't easily test Prometheus internals,
      // but we verify the tracker doesn't throw)
      const summary = tracker.getSummary();
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero tokens gracefully", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "edge-test-1",
      });

      const record = tracker.record({
        inputTokens: 0,
        latencyMs: 0,
        modelId: "openai/gpt-4o",
        outputTokens: 0,
      });

      expect(record.costUsd).toBe(0);
    });

    it("handles very large token counts", () => {
      const tracker = new UsageTracker({
        budgetUsd: 100.0,
        modelId: "google/gemini-2.5-pro",
        sessionId: "edge-test-2",
      });

      const record = tracker.record({
        inputTokens: 500_000,
        latencyMs: 5000,
        modelId: "google/gemini-2.5-pro",
        outputTokens: 50_000,
      });

      expect(record.costUsd).toBeGreaterThan(0);
      expect(Number.isFinite(record.costUsd)).toBe(true);
    });

    it("handles multiple models in same session", () => {
      const tracker = new UsageTracker({
        budgetUsd: 10.0,
        modelId: "openai/gpt-4o",
        sessionId: "edge-test-3",
      });

      tracker.record({
        inputTokens: 1_000,
        latencyMs: 100,
        modelId: "openai/gpt-4o",
        outputTokens: 500,
      });

      tracker.record({
        inputTokens: 2_000,
        latencyMs: 200,
        modelId: "anthropic/claude-sonnet-4",
        outputTokens: 1_000,
      });

      const summary = tracker.getSummary();
      expect(summary.modelBreakdown.size).toBe(2);
    });
  });
});
