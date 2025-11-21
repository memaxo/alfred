import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import "./utils/mock-metrics";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

// Mock graph dependency pulled transitively during router import
mock.module("@alfred/db/src/repo/graph", () => ({
  getGraphClient: vi.fn().mockReturnValue({}),
  upsertNodes: vi.fn().mockResolvedValue(new Map()),
  upsertEdges: vi.fn().mockResolvedValue(undefined),
}));

// Mock policy evaluate to attach an obligation
const evaluateMock = vi.fn();
mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
}));

// No-op audit
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Stub workflow repo persistence
mock.module("@alfred/db/repo/workflow", () => ({
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
  getRun: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockResolvedValue([]),
}));

// Stub runner to avoid async loop complexity here
const runPlanV6Mock = vi.fn();
mock.module("@alfred/api/workflow/runner", () => ({
  runPlanV6: runPlanV6Mock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    roles: ["user"],
    scopes: ["workflow.start"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("workflow router policy obligations", () => {
  it("rejects medium autonomy when biometric obligation present", async () => {
    evaluateMock.mockResolvedValue({
      allow: true,
      obligations: ["requireBio"],
    });
    runPlanV6Mock.mockReturnValue({
      runId: "run-1",
      summary: "stub",
      stream: (async function* () {})(),
      resume: async () => {},
      cancel: () => {},
    });

    await expect(
      caller.workflow.start({ requirement: "do X", auto: "medium" })
    ).rejects.toThrow(/biometric_required/i);
  });

  it("rejects stream when biometric obligation present (PRECONDITION_FAILED)", async () => {
    evaluateMock.mockResolvedValue({
      allow: true,
      obligations: ["requireBio"],
    });
    runPlanV6Mock.mockReturnValue({
      runId: "run-1",
      summary: "stub",
      stream: (async function* () {})(),
      resume: async () => {},
      cancel: () => {},
    });

    const sub: any = toObservable(
      caller.workflow.stream({ requirement: "do X", auto: "medium" })
    );
    await new Promise<void>((resolve) => {
      sub.subscribe({
        next: () => resolve(),
        error: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          expect(msg).toMatch(/biometric_required/i);
          resolve();
        },
        complete: () => resolve(),
      });
    });
  });
});
