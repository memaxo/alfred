/**
 * CarPlay Intent Classification Tests
 *
 * Tests for the local pattern-matching intent classifier.
 * Note: These tests use the function signature which returns
 * { intent, confidence, usedBackend } - we access intent.type
 */

import { beforeEach, describe, expect, it } from "bun:test";

import { useCarPlayStore } from "../../../lib/carplay/store";
import { classifyCarPlayIntent } from "../../../lib/carplay/voice/intent";

describe("CarPlay Intent Classification", () => {
  beforeEach(() => {
    useCarPlayStore.getState().reset();
  });

  describe("Status Queries", () => {
    // Note: "status" matches NAV_STATUS_PATTERNS first, returning navigation
    it('should classify "status" as navigation to status tab', async () => {
      const result = await classifyCarPlayIntent("status");
      expect(result.intent.type).toBe("navigation");
      if (result.intent.type === "navigation") {
        expect(result.intent.target).toBe("status");
      }
    });

    it('should classify "what is the status" as status_query', async () => {
      const result = await classifyCarPlayIntent("what is the status");
      expect(result.intent.type).toBe("status_query");
    });

    it('should classify "progress" as status_query', async () => {
      const result = await classifyCarPlayIntent("progress");
      expect(result.intent.type).toBe("status_query");
    });

    it('should classify "update" as status_query', async () => {
      const result = await classifyCarPlayIntent("update");
      expect(result.intent.type).toBe("status_query");
    });
  });

  describe("Decision Queries", () => {
    it('should classify "any decisions" as decision_query', async () => {
      const result = await classifyCarPlayIntent("any decisions");
      expect(result.intent.type).toBe("decision_query");
    });

    it('should classify "what needs my attention" as decision_query', async () => {
      const result = await classifyCarPlayIntent("what needs my attention");
      expect(result.intent.type).toBe("decision_query");
    });

    // Note: "escalation" matches NAV_DECISIONS_PATTERNS to navigate to decisions tab
    it('should classify "escalation" as navigation to decisions', async () => {
      const result = await classifyCarPlayIntent("escalation");
      expect(result.intent.type).toBe("navigation");
      if (result.intent.type === "navigation") {
        expect(result.intent.target).toBe("decisions");
      }
    });
  });

  describe("Escalation Actions (with pending decisions)", () => {
    beforeEach(() => {
      // Add an escalation so context-aware actions work
      useCarPlayStore.getState().addEscalation({
        id: "esc-1",
        workflowId: "wf-1",
        workflowName: "Test workflow",
        question: "Test question?",
        details: "",
        options: [],
        priority: "normal",
        severity: "warning",
        reason: "other",
        createdAt: Date.now(),
      });
    });

    it('should classify "approve" as escalation_action', async () => {
      const result = await classifyCarPlayIntent("approve");
      expect(result.intent.type).toBe("escalation_action");
      if (result.intent.type === "escalation_action") {
        expect(result.intent.action).toBe("approve");
      }
    });

    it('should classify "yes" as escalation_action approve', async () => {
      const result = await classifyCarPlayIntent("yes");
      expect(result.intent.type).toBe("escalation_action");
      if (result.intent.type === "escalation_action") {
        expect(result.intent.action).toBe("approve");
      }
    });

    it('should classify "reject" as escalation_action', async () => {
      const result = await classifyCarPlayIntent("reject");
      expect(result.intent.type).toBe("escalation_action");
      if (result.intent.type === "escalation_action") {
        expect(result.intent.action).toBe("reject");
      }
    });

    it('should classify "skip" as escalation_action defer', async () => {
      const result = await classifyCarPlayIntent("skip");
      expect(result.intent.type).toBe("escalation_action");
      if (result.intent.type === "escalation_action") {
        expect(result.intent.action).toBe("defer");
      }
    });
  });

  describe("PR Actions", () => {
    // Note: PR-specific patterns like "approve the PR" require backend classification
    // since the local patterns are context-aware (hasDecisions/hasPendingPlans)
    // These tests verify that PR-related commands don't get misclassified
    it('should not classify "approve the PR" as escalation_action when no decisions pending', async () => {
      useCarPlayStore.getState().reset();
      const result = await classifyCarPlayIntent("approve the PR");
      // Should fall through to conversational since no PR-specific local patterns
      expect(["pr_action", "conversational"].includes(result.intent.type)).toBe(
        true
      );
    });
  });

  describe("Plan Actions (with pending plans)", () => {
    beforeEach(() => {
      // Add a pending plan
      useCarPlayStore.getState().addPendingPlan({
        id: "plan-1",
        title: "Test Plan",
        runId: "run-1",
        requirement: "Test Plan",
        phases: [],
        estimatedTime: 30,
        riskLevel: "low",
        waveCount: 1,
        subtaskCount: 1,
        createdAt: Date.now(),
      });
    });

    it('should classify "approve the plan" as plan_action', async () => {
      const result = await classifyCarPlayIntent("approve the plan");
      expect(result.intent.type).toBe("plan_action");
      if (result.intent.type === "plan_action") {
        expect(result.intent.action).toBe("approve");
      }
    });

    it('should classify "reject the plan" as plan_action', async () => {
      const result = await classifyCarPlayIntent("reject the plan");
      expect(result.intent.type).toBe("plan_action");
      if (result.intent.type === "plan_action") {
        expect(result.intent.action).toBe("reject");
      }
    });
  });

  describe("Workflow Control", () => {
    it('should classify "pause" as workflow_control', async () => {
      const result = await classifyCarPlayIntent("pause");
      expect(result.intent.type).toBe("workflow_control");
      if (result.intent.type === "workflow_control") {
        expect(result.intent.action).toBe("pause");
      }
    });

    it('should classify "resume" as workflow_control', async () => {
      const result = await classifyCarPlayIntent("resume");
      expect(result.intent.type).toBe("workflow_control");
      if (result.intent.type === "workflow_control") {
        expect(result.intent.action).toBe("resume");
      }
    });

    it('should classify "continue" as workflow_control resume', async () => {
      const result = await classifyCarPlayIntent("continue");
      expect(result.intent.type).toBe("workflow_control");
      if (result.intent.type === "workflow_control") {
        expect(result.intent.action).toBe("resume");
      }
    });

    it('should classify "cancel" as workflow_control', async () => {
      const result = await classifyCarPlayIntent("cancel");
      expect(result.intent.type).toBe("workflow_control");
      if (result.intent.type === "workflow_control") {
        expect(result.intent.action).toBe("cancel");
      }
    });
  });

  describe("Navigation", () => {
    it('should classify "go to decisions" as navigation', async () => {
      const result = await classifyCarPlayIntent("go to decisions");
      expect(result.intent.type).toBe("navigation");
      if (result.intent.type === "navigation") {
        expect(result.intent.target).toBe("decisions");
      }
    });

    it('should classify "show PRs" as navigation', async () => {
      const result = await classifyCarPlayIntent("show PRs");
      expect(result.intent.type).toBe("navigation");
      if (result.intent.type === "navigation") {
        expect(result.intent.target).toBe("prs");
      }
    });

    it('should classify "go back" as navigation', async () => {
      const result = await classifyCarPlayIntent("go back");
      expect(result.intent.type).toBe("navigation");
      if (result.intent.type === "navigation") {
        expect(result.intent.target).toBe("back");
      }
    });
  });

  describe("Help", () => {
    it('should classify "help" as help', async () => {
      const result = await classifyCarPlayIntent("help");
      expect(result.intent.type).toBe("help");
    });

    it('should classify "what can you do" as help', async () => {
      const result = await classifyCarPlayIntent("what can you do");
      expect(result.intent.type).toBe("help");
    });
  });

  describe("Conversational Fallback", () => {
    it("should classify unrecognized input as conversational", async () => {
      const result = await classifyCarPlayIntent("how is the weather today");
      expect(result.intent.type).toBe("conversational");
    });
  });

  describe("Confidence", () => {
    it("should have high confidence for local matches", async () => {
      const result = await classifyCarPlayIntent("status");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.usedBackend).toBe(false);
    });
  });
});
