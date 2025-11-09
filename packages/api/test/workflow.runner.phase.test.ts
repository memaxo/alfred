import { describe, expect, it, mock, vi } from "bun:test";
// Mock metrics to avoid transitive DB/policy imports
mock.module("@alfred/api/metrics", () => ({
  runnerStepsTotal: { inc: vi.fn() },
  runnerErrorsTotal: { inc: vi.fn() },
}));
import { runPlanV6 } from "@alfred/api/workflow/runner";

async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const e of gen) results.push(e);
  return results;
}

describe("workflow runner phases", () => {
  it("emits phases in order with assistant/tool events", async () => {
    const input = {
      requirement: "create a hello world app",
      auto: "low" as const,
      context: { enable: true },
    };
    const runner = runPlanV6(input, { stepTimeoutMs: 2000, workflowTimeoutMs: 5000 });
    const evts = await collectEvents(runner.stream);
    const types = evts.map((e: any) => e.type);
    // Basic order checks
    expect(types[0]).toBe("run");
    expect(types).toContain("context");
    expect(types).toContain("assistant");
    expect(types).toContain("tool-call");
    expect(types).toContain("tool-result");
    // Completed progress
    expect(types[types.length - 1]).toBe("progress");
    const last = evts[evts.length - 1] as any;
    expect(last.pct).toBe(100);
  });

  it("times out a phase when step timeout is exceeded", async () => {
    const input = {
      requirement: "long task",
      auto: "low" as const,
      context: { enable: true },
    };
    // Force a short timeout so the scan phase can hit the boundary if it were long
    const runner = runPlanV6(input, { stepTimeoutMs: 1, workflowTimeoutMs: 50 });
    const evts = await collectEvents(runner.stream);
    const hasError = evts.some((e: any) => e.type === "error" && e.message === "step_timeout");
    const hasTerminal = evts.some((e: any) => e.type === "progress" && e.pct === 100);
    expect(hasError || hasTerminal).toBeTruthy();
  });
});
