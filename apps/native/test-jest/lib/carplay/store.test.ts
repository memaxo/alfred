/**
 * CarPlay Store Tests
 *
 * Tests for the Zustand store managing CarPlay state.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { useCarPlayStore } from "../../../lib/carplay/store";
import type {
  Escalation,
  ExecPlan,
  PullRequest,
  WorkflowState,
} from "../../../lib/carplay/types";

describe("CarPlay Store", () => {
  beforeEach(() => {
    useCarPlayStore.getState().reset();
  });

  describe("Connection Status", () => {
    it("should start disconnected", () => {
      const { connectionStatus } = useCarPlayStore.getState();
      expect(connectionStatus).toBe("disconnected");
    });

    it("should update connection status", () => {
      useCarPlayStore.getState().setConnectionStatus("connected");
      expect(useCarPlayStore.getState().connectionStatus).toBe("connected");
    });

    it("should track last sync time", () => {
      const now = Date.now();
      useCarPlayStore.getState().setLastSyncAt(now);
      expect(useCarPlayStore.getState().lastSyncAt).toBe(now);
    });
  });

  describe("Workflows", () => {
    const mockWorkflow: WorkflowState = {
      id: "wf-1",
      requirement: "Implement feature X",
      status: "running",
      progress: 50,
      completedTasks: 2,
      totalTasks: 4,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    };

    it("should set workflows", () => {
      useCarPlayStore.getState().setWorkflows([mockWorkflow]);
      const workflows = useCarPlayStore.getState().workflows;
      expect(workflows.size).toBe(1);
      expect(workflows.get("wf-1")?.requirement).toBe("Implement feature X");
    });

    it("should update existing workflow", () => {
      useCarPlayStore.getState().setWorkflows([mockWorkflow]);
      useCarPlayStore.getState().updateWorkflow("wf-1", { progress: 75 });
      const workflow = useCarPlayStore.getState().workflows.get("wf-1");
      expect(workflow?.progress).toBe(75);
    });

    it("should create new workflow on update if not exists", () => {
      useCarPlayStore.getState().updateWorkflow("wf-new", {
        requirement: "New workflow",
        status: "running",
      });
      const workflow = useCarPlayStore.getState().workflows.get("wf-new");
      expect(workflow).toBeDefined();
      expect(workflow?.requirement).toBe("New workflow");
    });

    it("should remove workflow", () => {
      useCarPlayStore.getState().setWorkflows([mockWorkflow]);
      useCarPlayStore.getState().removeWorkflow("wf-1");
      expect(useCarPlayStore.getState().workflows.size).toBe(0);
    });

    it("should get running workflows", () => {
      const workflows: WorkflowState[] = [
        { ...mockWorkflow, id: "wf-1", status: "running" },
        { ...mockWorkflow, id: "wf-2", status: "completed" },
        { ...mockWorkflow, id: "wf-3", status: "suspended" },
      ];
      useCarPlayStore.getState().setWorkflows(workflows);
      const running = useCarPlayStore.getState().getRunningWorkflows();
      expect(running.length).toBe(2); // running + suspended
    });
  });

  describe("Escalations", () => {
    const mockEscalation: Escalation = {
      id: "esc-1",
      workflowId: "wf-1",
      workflowName: "Test workflow",
      question: "Should I proceed with approach A or B?",
      details: "Implementation decision",
      priority: "high",
      severity: "warning",
      reason: "other",
      options: [
        { id: "opt-a", label: "Approach A", action: "custom", value: "A" },
        { id: "opt-b", label: "Approach B", action: "custom", value: "B" },
      ],
      createdAt: Date.now(),
    };

    it("should add escalation", () => {
      useCarPlayStore.getState().addEscalation(mockEscalation);
      expect(useCarPlayStore.getState().escalations.length).toBe(1);
    });

    it("should not add duplicate escalation", () => {
      useCarPlayStore.getState().addEscalation(mockEscalation);
      useCarPlayStore.getState().addEscalation(mockEscalation);
      expect(useCarPlayStore.getState().escalations.length).toBe(1);
    });

    it("should remove escalation", () => {
      useCarPlayStore.getState().addEscalation(mockEscalation);
      useCarPlayStore.getState().removeEscalation("esc-1");
      expect(useCarPlayStore.getState().escalations.length).toBe(0);
    });
  });

  describe("Decision Queue", () => {
    it("should sort by priority (critical > high > normal)", () => {
      const escalations: Escalation[] = [
        {
          id: "esc-1",
          workflowId: "wf-1",
          workflowName: "Test workflow",
          question: "Normal priority",
          details: "",
          priority: "normal",
          severity: "warning",
          reason: "other",
          options: [],
          createdAt: Date.now(),
        },
        {
          id: "esc-2",
          workflowId: "wf-1",
          workflowName: "Test workflow",
          question: "Critical priority",
          details: "",
          priority: "critical",
          severity: "warning",
          reason: "other",
          options: [],
          createdAt: Date.now(),
        },
        {
          id: "esc-3",
          workflowId: "wf-1",
          workflowName: "Test workflow",
          question: "High priority",
          details: "",
          priority: "high",
          severity: "warning",
          reason: "other",
          options: [],
          createdAt: Date.now(),
        },
      ];
      useCarPlayStore.getState().setEscalations(escalations);
      const queue = useCarPlayStore.getState().getDecisionQueue();
      expect(queue[0].priority).toBe("critical");
      expect(queue[1].priority).toBe("high");
      expect(queue[2].priority).toBe("normal");
    });
  });

  describe("Badge Counts", () => {
    it("should count decisions", () => {
      useCarPlayStore.getState().setEscalations([
        {
          id: "e1",
          workflowId: "w1",
          workflowName: "Test workflow",
          question: "Q1",
          details: "",
          priority: "normal",
          severity: "warning",
          reason: "other",
          options: [],
          createdAt: Date.now(),
        },
        {
          id: "e2",
          workflowId: "w1",
          workflowName: "Test workflow",
          question: "Q2",
          details: "",
          priority: "normal",
          severity: "warning",
          reason: "other",
          options: [],
          createdAt: Date.now(),
        },
      ]);
      expect(useCarPlayStore.getState().getDecisionCount()).toBe(2);
    });

    it("should count agent-created open PRs", () => {
      const prs: PullRequest[] = [
        {
          id: "pr-1",
          number: 1,
          title: "PR 1",
          author: "alice",
          repository: "o/r",
          branch: "b",
          baseBranch: "main",
          status: "open",
          reviewStatus: "pending",
          ciStatus: "pending",
          additions: 0,
          deletions: 0,
          filesChanged: 0,
          isAgentCreated: true,
          isDraft: false,
          url: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "pr-2",
          number: 2,
          title: "PR 2",
          author: "alice",
          repository: "o/r",
          branch: "b",
          baseBranch: "main",
          status: "merged",
          reviewStatus: "pending",
          ciStatus: "pending",
          additions: 0,
          deletions: 0,
          filesChanged: 0,
          isAgentCreated: true,
          isDraft: false,
          url: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "pr-3",
          number: 3,
          title: "PR 3",
          author: "alice",
          repository: "o/r",
          branch: "b",
          baseBranch: "main",
          status: "open",
          reviewStatus: "pending",
          ciStatus: "pending",
          additions: 0,
          deletions: 0,
          filesChanged: 0,
          isAgentCreated: false,
          isDraft: false,
          url: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      useCarPlayStore.getState().setPullRequests(prs);
      expect(useCarPlayStore.getState().getPRCount()).toBe(1);
    });

    it("should count pending plans", () => {
      const plans: ExecPlan[] = [
        {
          id: "p1",
          runId: "run-1",
          title: "Plan 1",
          requirement: "Plan 1",
          phases: [],
          estimatedTime: 30,
          riskLevel: "low",
          waveCount: 1,
          subtaskCount: 1,
          createdAt: Date.now(),
        },
      ];
      useCarPlayStore.getState().setPendingPlans(plans);
      expect(useCarPlayStore.getState().getPlanCount()).toBe(1);
    });
  });

  describe("Offline Commands", () => {
    it("should add offline command", () => {
      useCarPlayStore.getState().addOfflineCommand({
        id: "cmd-1",
        type: "escalation_decision",
        targetId: "esc-1",
        action: "approve",
        createdAt: Date.now(),
      });
      expect(useCarPlayStore.getState().offlineCommands.length).toBe(1);
    });

    it("should not add duplicate offline command", () => {
      const cmd = {
        id: "cmd-1",
        type: "escalation_decision" as const,
        targetId: "esc-1",
        action: "approve",
        createdAt: Date.now(),
      };
      useCarPlayStore.getState().addOfflineCommand(cmd);
      useCarPlayStore.getState().addOfflineCommand(cmd);
      expect(useCarPlayStore.getState().offlineCommands.length).toBe(1);
    });

    it("should remove offline command", () => {
      useCarPlayStore.getState().addOfflineCommand({
        id: "cmd-1",
        type: "escalation_decision",
        targetId: "esc-1",
        action: "approve",
        createdAt: Date.now(),
      });
      useCarPlayStore.getState().removeOfflineCommand("cmd-1");
      expect(useCarPlayStore.getState().offlineCommands.length).toBe(0);
    });

    it("should clear all offline commands", () => {
      useCarPlayStore.getState().addOfflineCommand({
        id: "cmd-1",
        type: "escalation_decision",
        targetId: "esc-1",
        action: "approve",
        createdAt: Date.now(),
      });
      useCarPlayStore.getState().addOfflineCommand({
        id: "cmd-2",
        type: "pr_decision",
        targetId: "pr-1",
        action: "approve",
        createdAt: Date.now(),
      });
      useCarPlayStore.getState().clearOfflineCommands();
      expect(useCarPlayStore.getState().offlineCommands.length).toBe(0);
    });
  });

  describe("Voice Status", () => {
    it("should update voice status", () => {
      useCarPlayStore.getState().setVoiceStatus("listening");
      expect(useCarPlayStore.getState().voiceStatus).toBe("listening");
      expect(useCarPlayStore.getState().isVoiceActive).toBe(true);
    });

    it("should set voice inactive on idle", () => {
      useCarPlayStore.getState().setVoiceStatus("listening");
      useCarPlayStore.getState().setVoiceStatus("idle");
      expect(useCarPlayStore.getState().isVoiceActive).toBe(false);
    });

    it("should set voice inactive on error", () => {
      useCarPlayStore.getState().setVoiceStatus("listening");
      useCarPlayStore.getState().setVoiceStatus("error");
      expect(useCarPlayStore.getState().isVoiceActive).toBe(false);
    });
  });

  describe("Reset", () => {
    it("should reset all state", () => {
      useCarPlayStore.getState().setConnectionStatus("connected");
      useCarPlayStore.getState().setWorkflows([
        {
          id: "wf-1",
          requirement: "Test",
          status: "running",
          progress: 50,
          completedTasks: 1,
          totalTasks: 2,
          startedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      useCarPlayStore.getState().setVoiceStatus("listening");

      useCarPlayStore.getState().reset();

      const state = useCarPlayStore.getState();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.workflows.size).toBe(0);
      expect(state.voiceStatus).toBe("idle");
      expect(state.offlineCommands.length).toBe(0);
    });
  });
});
