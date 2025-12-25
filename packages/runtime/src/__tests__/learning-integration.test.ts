import { describe, expect, it, mock, beforeEach } from "bun:test";
import { orchestrateWorkflowStream } from "../workflow/orchestrator.js";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";

// Mock dependencies
const mockGetRun = mock(async () => ({}));
const mockUpdateRun = mock(async () => ({}));
const mockGetPlanById = mock(async () => ({}));
const mockExtractPatternFromRun = mock(async () => ({}));
const mockExtractAntiPatternFromRun = mock(async () => ({}));
const mockLearnProjectConventions = mock(async () => ({}));

mock.module("@alfred/db/repo/workflow", () => ({
  getRun: mockGetRun,
  updateRun: mockUpdateRun,
  createRun: async () => ({}),
}));

mock.module("@alfred/db", () => ({
  planRepo: {
    getPlanById: mockGetPlanById,
  },
  workflowRepo: {
    getRun: mockGetRun,
    updateRun: mockUpdateRun,
    createRun: async () => ({}),
  },
}));

mock.module("@alfred/plan", () => ({
  extractPatternFromRun: mockExtractPatternFromRun,
  extractAntiPatternFromRun: mockExtractAntiPatternFromRun,
  learnProjectConventions: mockLearnProjectConventions,
}));

// Mock executor
const mockStream = (async function* () {
  yield { type: "progress", pct: 0.1 };
  yield {
    type: "event",
    kind: "agent-handoff",
    data: { summary: "Aggregated changes summary.", changes: { modified: [], created: [], deleted: [] } },
  };
  yield { type: "progress", pct: 1.0 };
})();

mock.module("./executor.js", () => ({
  createWorkflowExecutor: () => ({
    runId: "run-123",
    stream: mockStream,
  }),
  deriveWorkflowTitle: () => "Test Workflow",
  ensureWorkflowConversation: async () => ({ conversation: { id: "conv-123" }, created: true }),
  persistWorkflowMessages: async () => 1,
  createRequirementMessage: () => ({ id: "msg-1", role: "user", parts: [] }),
}));

describe("End-to-End Learning Lifecycle", () => {
  const mockInput: WorkflowInputPayload = {
    requirement: "Test requirement",
    auto: "low",
    mode: "sequential",
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
    mockGetRun.mockImplementation(async () => ({
      id: "run-123",
      status: "completed",
      userId: "user-123",
      projectId: "proj-123",
      inputData: { planId: "plan-123" },
    }) as any);

    mockGetPlanById.mockImplementation(async () => ({
      id: "plan-123",
      plan: { intent: "test" },
    }) as any);

    const stop = await orchestrateWorkflowStream(mockInput, mockSession, mockCallbacks);
    
    // Wait for async task to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(mockUpdateRun).toHaveBeenCalledWith("run-123", expect.objectContaining({
      status: "completed",
      stateData: { executionSummary: "Aggregated changes summary." }
    }));

    expect(mockExtractPatternFromRun).toHaveBeenCalled();
    expect(mockLearnProjectConventions).toHaveBeenCalledWith(
      expect.anything(),
      "proj-123",
      "Aggregated changes summary."
    );
  });
});
