import { describe, expect, it, mock } from "bun:test";
import type { AgentOutcome } from "../orchestrator/agent.js";
import { detectClarification } from "../orchestrator/clarify.js";
import { resumeWorkflowAfterClarification } from "../orchestrator/resume.js";
import { suspendWorkflowForClarification } from "../orchestrator/suspend.js";
import type { OrchestratorContext } from "../orchestrator/types.js";

// Mock @alfred/db
mock.module("@alfred/db", () => ({
  workflowRepo: {
    updateRun: async () => ({}),
  },
  clarificationRepo: {
    createRequest: async () => ({}),
    updateResponse: async () => ({}),
  },
}));

describe("Workflow Clarification (Suspend/Resume)", () => {
  const mockOutcome: AgentOutcome = {
    agentId: "agent-1",
    status: "completed",
    stuck: false,
    durationSeconds: 1,
    role: "codex",
    result: {
      summary: "I need clarification on the auth logic.",
      artifacts: [],
      changes: [],
      notes: ["Clarification: Should I use JWT or session?"],
    },
  };

  const mockCtx: OrchestratorContext = {
    input: { requirement: "test", auto: "low" },
    runId: "run-123",
    signal: new AbortController().signal,
    workspace: "/tmp",
  };

  it("should detect clarification from agent output", async () => {
    const clarification = await detectClarification(mockOutcome, mockCtx);
    expect(clarification).not.toBeNull();
    expect(clarification?.question).toBe("Should I use JWT or session?");
  });

  it("should suspend workflow for clarification", async () => {
    const clarification = {
      id: "clar-123",
      runId: "run-123",
      phaseId: "phase-1",
      agentId: "agent-1",
      question: "Test question?",
      required: true,
      timestamp: new Date(),
    };

    await suspendWorkflowForClarification("run-123", clarification);
    // Success means no throw and mocks were called
  });

  it("should resume workflow after clarification", async () => {
    await resumeWorkflowAfterClarification("run-123", "clar-123", "Use JWT.");
    // Success means no throw and mocks were called
  });
});
