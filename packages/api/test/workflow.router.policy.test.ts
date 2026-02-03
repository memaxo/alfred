import type { PipelineEvent } from "@alfred/pipeline";
import type { Obligation } from "@alfred/type";

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
  upsertEdges: vi.fn().mockResolvedValue(),
}));

// Mock policy evaluate to attach an obligation
const evaluateMock = vi.fn();
mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
}));

// No-op audit
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(),
  queryAuditLogs: vi.fn().mockResolvedValue({ rows: [], totalCount: 0 }),
}));

// Stub workflow repo persistence
mock.module("@alfred/db/repo/workflow", () => ({
  createRun: vi.fn().mockResolvedValue(),
  updateRun: vi.fn().mockResolvedValue(),
  appendEvent: vi.fn().mockResolvedValue(),
  getRun: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockResolvedValue([]),
}));

// Stub runner to avoid async loop complexity here
const runPlanV6Mock = vi.fn();
mock.module("@alfred/api/workflow/runner", () => ({
  runPlanV6: runPlanV6Mock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

const bioObligation: Obligation = {
  type: "biometric",
  reason: "biometric_required",
  metadata: { code: "requireBio" },
};

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
      obligations: [bioObligation],
    });
    runPlanV6Mock.mockReturnValue({
      runId: "run-1",
      summary: "stub",
      stream: (async function* stream() {})(),
      resume: async () => {},
      cancel: () => {},
    });

    await expect(
      caller.workflow.start({ requirement: "do X", auto: "medium" })
    ).rejects.toThrow(/obligation_required/i);
  });

  it("suspends pipeline stream when biometric obligation present", async () => {
    evaluateMock.mockResolvedValue({
      allow: true,
      obligations: [bioObligation],
    });
    runPlanV6Mock.mockReturnValue({
      runId: "run-1",
      summary: "stub",
      stream: (async function* stream() {})(),
      resume: async () => {},
      cancel: () => {},
    });

    const sub: any = toObservable(
      caller.workflow.streamPipeline({ requirement: "do X", auto: "medium" })
    );
    await new Promise<void>((resolve, reject) => {
      const dispose = sub.subscribe({
        next: (event: PipelineEvent) => {
          try {
            expect(event.type).toBe("pipeline:suspend");
            dispose();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        error: reject,
        complete: resolve,
      });
    });
  });
});
