import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import { z } from "zod";

// Mock dependencies
const mockGetRun = mock(async () => ({}));
const mockUpdateRun = mock(async (_runId: string, _patch: unknown) => ({}));
const mockGetPlanById = mock(async () => ({}));
const mockExtractPatternFromRun = mock(async () => ({}));
const mockExtractAntiPatternFromRun = mock(async () => ({}));
const mockLearnProjectConventions = mock(async () => ({}));

mock.module("@alfred/db/repo/workflow", () => ({
  getRun: mockGetRun,
  updateRun: mockUpdateRun,
  createRun: async () => ({}),
}));

mock.module("@alfred/db/repo/plan", () => ({
  getPlanById: mockGetPlanById,
}));

mock.module("@alfred/agent/utils/audit", () => ({
  recordAudit: async () => {},
}));

mock.module("@alfred/agent/workflow/linear", () => ({
  ensureLinearTicket: async () => ({ linear: null, ticket: null }),
}));

mock.module("@alfred/plan", () => ({
  structuredPlanSchema: z.object({}).passthrough(),
}));

mock.module("@alfred/plan/pattern", () => ({
  extractPatternFromRun: mockExtractPatternFromRun,
  extractAntiPatternFromRun: mockExtractAntiPatternFromRun,
}));

mock.module("@alfred/plan/project", () => ({
  learnProjectConventions: mockLearnProjectConventions,
}));

// Mock executor
const mockStream = (async function* () {
  yield { _: "progress", pct: 10, message: "starting" };
  yield {
    type: "event",
    kind: "agent-handoff",
    data: {
      summary: "Aggregated changes summary.",
      changes: { modified: [], created: [], deleted: [] },
    },
  };
  yield { _: "progress", pct: 100, message: "completed" };
})();

// NOTE: This file uses mock.module() which causes test pollution.
// See describe.skip comment below.
mock.module("../workflow/executor.js", () => ({
  createWorkflowExecutor: () => ({
    runId: "run-123",
    stream: mockStream,
  }),
  deriveWorkflowTitle: () => "Test Workflow",
  ensureWorkflowConversation: async () => ({
    conversation: { id: "conv-123" },
    created: true,
  }),
  persistWorkflowMessages: async () => 1,
  createRequirementMessage: () => ({ id: "msg-1", role: "user", parts: [] }),
}));

mock.module("../workflow/history.js", () => ({
  loadHistory: async () => [],
}));

mock.module("../workflow/persist.js", () => ({
  persistStreamEvent: async () => null,
}));

const { orchestrateWorkflowStream } = await import(
  "../workflow/orchestrator.js"
);

// SKIP: These tests pass in isolation but fail when run with other tests due to
// Bun's mock.module() not isolating properly between test files.
// TODO: Refactor to use dependency injection instead of mock.module()
describe.skip("End-to-End Learning Lifecycle", () => {
  const mockInput: WorkflowInputPayload = {
    requirement: "Test requirement",
    auto: "low",
    mode: "sequential",
    runId: "run-123",
  };

  const mockSession = { user: { id: "user-123" } };

  const mockCallbacks = {
    triggerPreferenceRefresh: () => {},
    emitError: () => {},
    emitNext: () => {},
    emitComplete: () => {},
  };

  beforeEach(() => {
    mockGetRun.mockClear();
    mockUpdateRun.mockClear();
    mockGetPlanById.mockClear();
    mockExtractPatternFromRun.mockClear();
    mockExtractAntiPatternFromRun.mockClear();
    mockLearnProjectConventions.mockClear();
  });

  it("should collect handoffs and trigger completion learning with summary", async () => {
    const workflowRepo = await import("@alfred/db/repo/workflow");
    expect(workflowRepo.updateRun).toBeDefined();

    mockGetRun.mockImplementation(
      async () =>
        ({
          id: "run-123",
          status: "completed",
          userId: "user-123",
          projectId: "proj-123",
          inputData: { planId: "plan-123" },
        }) as any
    );

    mockGetPlanById.mockImplementation(
      async () =>
        ({
          id: "plan-123",
          plan: { intent: "test" },
        }) as any
    );

    await orchestrateWorkflowStream(mockInput, mockSession, mockCallbacks);

    // Wait for async task to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(mockUpdateRun).toHaveBeenCalled();
    const calledWithCompleted = mockUpdateRun.mock.calls.some((call) => {
      const [runId, patch] = call as [unknown, unknown];
      if (runId !== "run-123") {
        return false;
      }
      if (!patch || typeof patch !== "object") {
        return false;
      }
      const obj = patch as { status?: unknown; stateData?: unknown };
      if (obj.status !== "completed") {
        return false;
      }
      const state = obj.stateData as { executionSummary?: unknown } | undefined;
      return state?.executionSummary === "Aggregated changes summary.";
    });
    expect(calledWithCompleted).toBe(true);

    expect(mockExtractPatternFromRun).toHaveBeenCalled();
    expect(mockLearnProjectConventions).toHaveBeenCalledWith(
      expect.anything(),
      "proj-123",
      "Aggregated changes summary."
    );
  });
});
