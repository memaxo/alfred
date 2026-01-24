/**
 * CarPlay Speech Generator Tests
 *
 * Tests for TTS speech generation functions.
 * These verify that speech functions produce non-empty output.
 */

import { describe, expect, it } from "bun:test";

import type {
  Escalation,
  ExecPlan,
  PullRequest,
  WorkflowState,
} from "../../../lib/carplay/types";

import {
  speakConfirmation,
  speakError,
  speakEscalation,
  speakGreeting,
  speakPlanSummary,
  speakPRSummary,
  speakWorkflowUpdate,
} from "../../../lib/carplay/voice/speech";

describe("CarPlay Speech Generators", () => {
  describe("speakWorkflowUpdate", () => {
    const baseWorkflow: WorkflowState = {
      id: "wf-1",
      requirement: "Implement user authentication",
      status: "running",
      progress: 50,
      completedTasks: 2,
      totalTasks: 4,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    };

    it("should generate progress update", () => {
      const speech = speakWorkflowUpdate(baseWorkflow, "progress");
      expect(speech.length).toBeGreaterThan(0);
      expect(speech).toContain("50%");
    });

    it("should generate completion announcement", () => {
      const completed: WorkflowState = {
        ...baseWorkflow,
        status: "completed",
        progress: 100,
      };
      const speech = speakWorkflowUpdate(completed, "completed");
      expect(speech.length).toBeGreaterThan(0);
    });

    it("should generate error announcement", () => {
      const failed: WorkflowState = {
        ...baseWorkflow,
        status: "failed",
        progress: 0,
      };
      const speech = speakWorkflowUpdate(failed, "failed");
      expect(speech.length).toBeGreaterThan(0);
    });
  });

  describe("speakEscalation", () => {
    const baseEscalation: Escalation = {
      id: "esc-1",
      workflowId: "wf-1",
      workflowName: "Test workflow",
      question: "Should I use REST or GraphQL for the API?",
      details: "Building the backend",
      priority: "high",
      severity: "warning",
      reason: "other",
      options: [
        { id: "opt-1", label: "REST", action: "custom", value: "REST" },
        { id: "opt-2", label: "GraphQL", action: "custom", value: "GraphQL" },
      ],
      createdAt: Date.now(),
    };

    it("should produce non-empty speech", () => {
      const speech = speakEscalation(baseEscalation);
      expect(speech.length).toBeGreaterThan(0);
    });
  });

  describe("speakPRSummary", () => {
    const basePR: PullRequest = {
      id: "pr-1",
      number: 42,
      title: "Add user authentication",
      author: "alice",
      repository: "acme/webapp",
      branch: "feature",
      baseBranch: "main",
      url: "https://github.com/acme/webapp/pull/42",
      status: "open",
      reviewStatus: "pending",
      ciStatus: "pending",
      isAgentCreated: true,
      isDraft: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      additions: 150,
      deletions: 20,
      filesChanged: 5,
    };

    it("should include PR number", () => {
      const speech = speakPRSummary(basePR);
      expect(speech).toContain("42");
    });

    it("should produce non-empty speech", () => {
      const speech = speakPRSummary(basePR);
      expect(speech.length).toBeGreaterThan(0);
    });
  });

  describe("speakPlanSummary", () => {
    const basePlan: ExecPlan = {
      id: "plan-1",
      title: "Authentication Implementation",
      runId: "run-1",
      requirement: "Authentication Implementation",
      phases: [
        {
          id: "p1",
          name: "Setup database",
          taskCount: 2,
          estimatedMinutes: 10,
        },
        { id: "p2", name: "Implement API", taskCount: 2, estimatedMinutes: 20 },
      ],
      estimatedTime: 30,
      riskLevel: "medium",
      waveCount: 1,
      subtaskCount: 4,
      createdAt: Date.now(),
    };

    it("should produce non-empty speech", () => {
      const speech = speakPlanSummary(basePlan);
      expect(speech.length).toBeGreaterThan(0);
    });

    it("should mention plan title", () => {
      const speech = speakPlanSummary(basePlan);
      expect(speech.toLowerCase()).toContain("authentication");
    });
  });

  describe("speakConfirmation", () => {
    it("should produce confirmation speech for approve", () => {
      const speech = speakConfirmation("approved", "escalation");
      expect(speech.length).toBeGreaterThan(0);
    });

    it("should produce confirmation speech for reject", () => {
      const speech = speakConfirmation("rejected", "plan");
      expect(speech.length).toBeGreaterThan(0);
    });

    it("should produce confirmation speech for defer", () => {
      const speech = speakConfirmation("deferred", "PR");
      expect(speech.length).toBeGreaterThan(0);
    });
  });

  describe("speakGreeting", () => {
    it("should return a non-empty greeting", () => {
      const speech = speakGreeting(0, 0);
      expect(speech.length).toBeGreaterThan(0);
    });
  });

  describe("speakError", () => {
    it("should produce error speech", () => {
      const speech = speakError("network");
      expect(speech.length).toBeGreaterThan(0);
    });
  });
});
