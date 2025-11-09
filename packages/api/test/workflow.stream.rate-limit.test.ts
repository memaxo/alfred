import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { mockWorkflowRepo, mockRunRegistry, mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import "./utils/mock-metrics";
import { createTestCaller } from "./utils/trpc";
import { toObservable } from "./utils/stream";
import type { WorkflowEvent } from "@alfred/type";

setupTestEnv();
mockPolicyAudit();

// Stub policy + metrics to avoid import-time errors
const evaluateMock = vi.fn();
mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: () => {},
}));

// Use real metrics; only policy is mocked to avoid registerCacheObs import errors

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
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
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
    await new Promise<void>((resolve, reject) => {
      toObservable(caller.workflow.stream({ requirement: "A" })).subscribe({ next: () => {}, error: reject, complete: resolve });
    });

    // 2nd invocation (allowed)
    await new Promise<void>((resolve, reject) => {
      toObservable(caller.workflow.stream({ requirement: "B" })).subscribe({ next: () => {}, error: reject, complete: resolve });
    });

    // 3rd invocation should hit rate limit (429)
    // 3rd invocation should hit rate limit (429). Some environments throw synchronously; others error via observable.
    let matched = false;
    try {
      // Some environments may throw synchronously
      await new Promise<void>((resolve) => {
        toObservable(caller.workflow.stream({ requirement: "C" })).subscribe({
          next: () => resolve(),
          error: (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (/rate_limited/i.test(msg)) matched = true;
            resolve();
          },
          complete: () => resolve(),
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/rate_limited/i.test(msg)) matched = true;
    }
    expect(matched).toBe(true);
  });
});
