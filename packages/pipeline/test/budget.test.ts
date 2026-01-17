import { describe, expect, it } from "bun:test";
import { getBudgetUsd, getTotalCost, setBudgetUsd } from "../src/budget";
import { type ContextOptions, createPipelineContext } from "../src/context";

describe("Budget Enforcement", () => {
  function createTestContext(
    overrides: Partial<ContextOptions> = {}
  ): ReturnType<typeof createPipelineContext> {
    return createPipelineContext({
      runId: "test-run",
      requirement: "test",
      workspace: "/tmp/test",
      userId: "test-user",
      config: {} as any,
      emit: () => {},
      ...overrides,
    });
  }

  describe("getBudgetUsd / setBudgetUsd", () => {
    it("returns default budget when not set", () => {
      const ctx = createTestContext();
      const budget = getBudgetUsd(ctx);
      expect(budget).toBe(10.0); // Default from budget.ts
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
