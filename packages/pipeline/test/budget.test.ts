import { afterEach, describe, expect, it } from "bun:test";
import { clearRunCosts, getTrackedRuns } from "@alfred/metrics";
import {
  getBudgetUsd,
  getTotalCost,
  recordPipelineCost,
  setBudgetUsd,
} from "../src/budget";
import { type ContextOptions, createPipelineContext } from "../src/context";
import { DEFAULT_CONFIG } from "../src/pipeline";

describe("Budget Enforcement", () => {
  function createTestContext(
    overrides: Partial<ContextOptions> = {}
  ): ReturnType<typeof createPipelineContext> {
    return createPipelineContext({
      runId: "test-run",
      requirement: "test",
      workspace: "/tmp/test",
      userId: "test-user",
      config: DEFAULT_CONFIG,
      emit: () => {},
      ...overrides,
    });
  }

  afterEach(() => {
    for (const runId of getTrackedRuns()) {
      clearRunCosts(runId);
    }
  });

  describe("getBudgetUsd / setBudgetUsd", () => {
    it("returns default budget when not set", () => {
      const ctx = createTestContext();
      const budget = getBudgetUsd(ctx);
      expect(budget).toBe(10.0);
    });

    it("returns custom budget when set", () => {
      const ctx = createTestContext();
      setBudgetUsd(ctx, 25.5);
      const budget = getBudgetUsd(ctx);
      expect(budget).toBe(25.5);
    });

    it("stores budget in context", () => {
      const ctx = createTestContext();
      setBudgetUsd(ctx, 15.0);
      expect(ctx.get<number>("budget:limit")).toBe(15.0);
    });
  });

  describe("recordPipelineCost", () => {
    it("records and accumulates costs in context", () => {
      const ctx = createTestContext();

      recordPipelineCost(ctx, "openai", "gpt-4o-mini", 50_000, 25_000);
      recordPipelineCost(ctx, "openai", "gpt-4o-mini", 30_000, 15_000);

      const total = getTotalCost(ctx);
      expect(total).toBeGreaterThan(0);
    });

    it("emits budget:warning when approaching limit", () => {
      const events: Array<{ type: string; percentUsed?: number }> = [];
      const ctx = createTestContext({
        emit: (event) => events.push(event),
      });

      setBudgetUsd(ctx, 1.0);
      recordPipelineCost(ctx, "openai", "gpt-4o-mini", 0, 1_600_000);

      const warningEvent = events.find((e) => e.type === "budget:warning");
      expect(warningEvent).toBeDefined();
      expect(warningEvent?.percentUsed ?? 0).toBeGreaterThan(90);
    });

    it("emits budget:exceeded when limit reached", () => {
      const events: Array<{ type: string; costUsd?: number }> = [];
      const ctx = createTestContext({
        emit: (event) => events.push(event),
      });

      setBudgetUsd(ctx, 1.0);
      recordPipelineCost(ctx, "openai", "gpt-4o-mini", 0, 2_000_000);

      const exceededEvent = events.find((e) => e.type === "budget:exceeded");
      expect(exceededEvent).toBeDefined();
      expect(exceededEvent?.costUsd ?? 0).toBeGreaterThan(1.0);
    });
  });

  describe("getTotalCost", () => {
    it("returns 0 when no costs recorded", () => {
      const ctx = createTestContext();
      const total = getTotalCost(ctx);
      expect(total).toBe(0);
    });

    it("returns stored total cost", () => {
      const ctx = createTestContext();
      ctx.set("cost:total", 5.25);
      const total = getTotalCost(ctx);
      expect(total).toBe(5.25);
    });
  });
});
