import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { mockWorkflowRepo, mockRunRegistry, mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";
import type { WorkflowEvent } from "@alfred/type";

setupTestEnv();
mockPolicyAudit();

// Lower the per-minute limit for this test case
process.env.ROUTE_RATE_LIMIT_PER_MINUTE = "2";

const workflowRunnerMocks = (() => {
  const runPlanV6 = vi.fn();
  mock.module("@alfred/api/workflow/runner", () => ({ runPlanV6 }));
  return { runPlanV6 };
})();

// Mock workflow repo and run-registry to avoid DB/persistence
const workflowRepoMocks = mockWorkflowRepo();
const runRegistryMocks = mockRunRegistry();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({ roles: ["user"], scopes: ["workflow.plan", "workflow.stream", "workflow.resume"] });
});

afterEach(() => {
  resetAllMocks();
});

describe.skip("workflow.stream rate limit", () => {
  it("enforces per-minute limit for subscription", async () => {
    const mockRunId = "rate-run";
    const mkStream = async function* () {
      yield { type: "run", id: mockRunId } as WorkflowEvent;
      yield { type: "progress", pct: 100, message: "done" } as WorkflowEvent;
    };

    workflowRunnerMocks.runPlanV6.mockReturnValue({
      runId: mockRunId,
      summary: "ok",
      stream: mkStream(),
      resume: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    });

    // 1st invocation (allowed)
    const s1: any = caller.workflow.stream({ requirement: "A" });
    if (s1 && typeof s1.subscribe === "function") {
      await new Promise<void>((resolve, reject) => {
        s1.subscribe({ next: () => {}, error: reject, complete: resolve });
      });
    }

    // 2nd invocation (allowed)
    const s2: any = caller.workflow.stream({ requirement: "B" });
    if (s2 && typeof s2.subscribe === "function") {
      await new Promise<void>((resolve, reject) => {
        s2.subscribe({ next: () => {}, error: reject, complete: resolve });
      });
    }

    // 3rd invocation should hit rate limit (429)
    let threw = false;
    try {
      const s3: any = caller.workflow.stream({ requirement: "C" });
      if (s3 && typeof s3.subscribe === "function") {
        await new Promise<void>((resolve) => {
          s3.subscribe({
            next: () => {},
            error: (err: unknown) => {
              threw = true;
              const msg = err instanceof Error ? err.message : String(err);
              expect(msg).toMatch(/rate_limited/i);
              resolve();
            },
            complete: () => resolve(),
          });
        });
      }
    } catch (err) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toMatch(/rate_limited/i);
    }
    expect(threw).toBe(true);
  });
});
