import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { metricsStub } from "./utils/mock-metrics";
import {
  mockPolicyAudit,
  mockRunRegistry,
  mockWorkflowRepo,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";

// Provide targeted metrics mocks for rate limit path so we can assert increments
const rateLimitInc = vi.fn();
mock.module("@alfred/api/src/metrics", () => ({
  ...metricsStub,
  rateLimitHitsTotal: { inc: rateLimitInc },
}));
// Mock package metrics as well (trpc.ts uses package path)
mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
  rateLimitHitsTotal: { inc: rateLimitInc },
}));

import type { Obligation, WorkflowEvent } from "@alfred/type";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

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
const _workflowRepoMocks = mockWorkflowRepo();
const _runRegistryMocks = mockRunRegistry();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    roles: ["user"],
    scopes: ["workflow.plan", "workflow.stream", "workflow.resume"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("workflow.stream rate limit", () => {
  it("enforces per-minute limit for subscription", async () => {
    evaluateMock.mockResolvedValue({
      allow: true,
      obligations: [] as Obligation[],
    });
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
      toObservable(caller.workflow.stream({ requirement: "A" })).subscribe({
        next: () => {},
        error: reject,
        complete: resolve,
      });
    });

    // 2nd invocation (allowed)
    await new Promise<void>((resolve, reject) => {
      toObservable(caller.workflow.stream({ requirement: "B" })).subscribe({
        next: () => {},
        error: reject,
        complete: resolve,
      });
    });

    // 3rd invocation should hit rate limit (429)
    // 3rd invocation should hit rate limit (429). Some environments throw synchronously; others error via observable.
    let matched = false;
    try {
      // Prefer direct call to capture synchronous throws from middleware
      // If it does not throw synchronously, subscribe to capture observable error.
      const candidate: any = caller.workflow.stream({ requirement: "C" });
      if (candidate && typeof candidate.subscribe === "function") {
        await new Promise<void>((resolve) => {
          candidate.subscribe({
            next: () => resolve(),
            error: (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              if (/rate_limited/i.test(msg)) {
                matched = true;
              }
              resolve();
            },
            complete: () => resolve(),
          });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/rate_limited/i.test(msg)) {
        matched = true;
      }
    }
    // Either we saw the error or metrics recorded a hit
    const incCalled = rateLimitInc.mock.calls.some((args) => {
      const [labels] = args;
      return (
        labels &&
        (labels.procedure === "workflow.stream" ||
          labels.procedure === undefined)
      );
    });
    expect(matched || incCalled).toBe(true);
  });
});
