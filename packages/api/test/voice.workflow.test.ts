/**
 * Tests for voice workflow integration.
 *
 * Tests the voice → workflow bridge including:
 * - Intent classification
 * - Plan-to-speech conversion
 * - Workflow state machine
 * - Session context management
 */

import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

// Mock the classification model
const mockGenerateObject = vi.fn();
mock.module("ai", () => ({
  generateObject: mockGenerateObject,
}));

// Mock the agent selector
mock.module("@alfred/agent/selector", () => ({
  getClassificationModel: () => ({
    model: {},
    modelKey: "test-model",
    capabilities: ["genui"],
  }),
  getModelForRole: () => ({
    model: {},
    modelKey: "test-model",
    capabilities: [],
  }),
}));

// Mock Redis (use in-memory)
mock.module("@alfred/auth/redis", () => ({
  getRedis: () => null,
}));

describe("voice workflow", () => {
  beforeAll(() => {
    // Use heuristic fallback for tests (no LLM calls)
    process.env.ALFRED_CLASSIFY_OFFLINE = "1";
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe("intent classification", () => {
    it("classifies workflow intent with keywords", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      // Use a phrase with multiple workflow keywords for reliable heuristic detection
      const result = await classifyVoiceIntent(
        "build and create a new api endpoint feature"
      );

      expect(result.type).toBe("workflow");
      if (result.type === "workflow") {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it("classifies conversational intent", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      const result = await classifyVoiceIntent("what time is it");

      expect(result.type).toBe("conversational");
    });

    it("detects approval in awaiting_approval state", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");
      const { createAwaitingApprovalState } = await import(
        "../src/voice/workflow-state.js"
      );

      const sessionContext = {
        state: createAwaitingApprovalState({
          runId: "test-run",
          planId: "test-plan",
          summary: "Test plan",
          waveCount: 2,
          subtaskCount: 5,
        }),
        originalTranscript: "build something",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await classifyVoiceIntent(
        "yes, approve it",
        sessionContext
      );

      expect(result.type).toBe("approval");
      if (result.type === "approval") {
        expect(result.action).toBe("approve");
      }
    });

    it("detects rejection in awaiting_approval state", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");
      const { createAwaitingApprovalState } = await import(
        "../src/voice/workflow-state.js"
      );

      const sessionContext = {
        state: createAwaitingApprovalState({
          runId: "test-run",
          planId: "test-plan",
          summary: "Test plan",
          waveCount: 2,
          subtaskCount: 5,
        }),
        originalTranscript: "build something",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await classifyVoiceIntent(
        "no, cancel that",
        sessionContext
      );

      expect(result.type).toBe("approval");
      if (result.type === "approval") {
        expect(result.action).toBe("reject");
      }
    });

    it("detects status query", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      const result = await classifyVoiceIntent("what's the status");

      expect(result.type).toBe("status_query");
    });
  });

  describe("plan-to-speech conversion", () => {
    it("converts simple plan to speech", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");

      const plan = {
        id: "test-plan",
        title: "Test Plan",
        intent: "Build authentication",
        phases: [
          {
            id: "phase-1",
            name: "Setup",
            description: "Initial setup",
            tasks: [{ id: "task-1" }, { id: "task-2" }],
            dependsOn: [],
            estimatedDurationMs: 60_000,
            agentType: "codex" as const,
          },
        ],
        resources: {
          agentCount: 1,
          strategy: "sequential" as const,
          isolation: "agentfs" as const,
        },
        evaluationCriteria: [],
      };

      const speech = planToSpeech(plan as Parameters<typeof planToSpeech>[0]);

      expect(speech).toContain("plan");
      expect(speech).toContain("task");
      expect(speech).toContain("agent");
      expect(speech).toContain("approve");
    });

    it("handles multi-phase plans", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");

      const plan = {
        id: "test-plan",
        title: "Complex Plan",
        intent: "Build feature",
        phases: [
          {
            id: "phase-1",
            name: "Backend Setup",
            description: "Setup backend",
            tasks: [{ id: "t1" }, { id: "t2" }],
            dependsOn: [],
            estimatedDurationMs: 120_000,
            agentType: "codex" as const,
          },
          {
            id: "phase-2",
            name: "Frontend Implementation",
            description: "Build UI",
            tasks: [{ id: "t3" }, { id: "t4" }, { id: "t5" }],
            dependsOn: ["phase-1"],
            estimatedDurationMs: 180_000,
            agentType: "codex" as const,
          },
          {
            id: "phase-3",
            name: "Testing",
            description: "Add tests",
            tasks: [{ id: "t6" }],
            dependsOn: ["phase-2"],
            estimatedDurationMs: 60_000,
            agentType: "codex" as const,
          },
        ],
        waves: [
          { id: "w1", agents: ["t1", "t2"], dependsOn: [] },
          { id: "w2", agents: ["t3", "t4", "t5"], dependsOn: ["w1"] },
          { id: "w3", agents: ["t6"], dependsOn: ["w2"] },
        ],
        resources: {
          agentCount: 3,
          strategy: "topological" as const,
          isolation: "agentfs" as const,
        },
        evaluationCriteria: [],
      };

      const speech = planToSpeech(plan as Parameters<typeof planToSpeech>[0]);

      expect(speech).toContain("3 phases");
      expect(speech).toContain("6 total tasks");
      expect(speech).toContain("3 agents");
      expect(speech).toContain("3 waves");
    });

    it("includes duration estimate", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");

      const plan = {
        id: "test-plan",
        title: "Timed Plan",
        intent: "Build feature",
        phases: [
          {
            id: "phase-1",
            name: "Implementation",
            description: "Build it",
            tasks: [{ id: "t1" }],
            dependsOn: [],
            estimatedDurationMs: 300_000, // 5 minutes
            agentType: "codex" as const,
          },
        ],
        resources: {
          agentCount: 1,
          strategy: "sequential" as const,
          isolation: "agentfs" as const,
        },
        evaluationCriteria: [],
      };

      const speech = planToSpeech(plan as Parameters<typeof planToSpeech>[0]);

      expect(speech).toContain("5 minutes");
    });
  });

  describe("workflow state machine", () => {
    it("creates idle state", async () => {
      const { createIdleState } = await import(
        "../src/voice/workflow-state.js"
      );

      const state = createIdleState();

      expect(state.phase).toBe("idle");
    });

    it("creates planning state", async () => {
      const { createPlanningState } = await import(
        "../src/voice/workflow-state.js"
      );

      const state = createPlanningState("run-123");

      expect(state.phase).toBe("planning");
      expect(state.runId).toBe("run-123");
    });

    it("creates awaiting approval state", async () => {
      const { createAwaitingApprovalState } = await import(
        "../src/voice/workflow-state.js"
      );

      const state = createAwaitingApprovalState({
        runId: "run-123",
        planId: "plan-456",
        summary: "Test plan summary",
        waveCount: 2,
        subtaskCount: 5,
      });

      expect(state.phase).toBe("awaiting_approval");
      if (state.phase === "awaiting_approval") {
        expect(state.runId).toBe("run-123");
        expect(state.planId).toBe("plan-456");
        expect(state.waveCount).toBe(2);
        expect(state.subtaskCount).toBe(5);
      }
    });

    it("creates executing state", async () => {
      const { createExecutingState } = await import(
        "../src/voice/workflow-state.js"
      );

      const state = createExecutingState("run-123");

      expect(state.phase).toBe("executing");
      if (state.phase === "executing") {
        expect(state.runId).toBe("run-123");
        expect(state.startedAt).toBeGreaterThan(0);
      }
    });

    it("serializes and deserializes context", async () => {
      const {
        createAwaitingApprovalState,
        deserializeWorkflowContext,
        serializeWorkflowContext,
      } = await import("../src/voice/workflow-state.js");

      const context = {
        state: createAwaitingApprovalState({
          runId: "run-123",
          planId: "plan-456",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 3,
        }),
        originalTranscript: "build a feature",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serialized = serializeWorkflowContext(context);
      const deserialized = deserializeWorkflowContext(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized?.state.phase).toBe("awaiting_approval");
      expect(deserialized?.originalTranscript).toBe("build a feature");
    });
  });

  describe("session context management", () => {
    it("sets and gets workflow context", async () => {
      const {
        clearVoiceWorkflowContext,
        getVoiceWorkflowContext,
        setVoiceWorkflowContext,
      } = await import("../src/voice/session-context.js");
      const { createPlanningState } = await import(
        "../src/voice/workflow-state.js"
      );

      const userId = "test-user-123";
      const context = {
        state: createPlanningState("run-abc"),
        originalTranscript: "test request",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setVoiceWorkflowContext(userId, context);
      const retrieved = await getVoiceWorkflowContext(userId);

      expect(retrieved).not.toBeUndefined();
      expect(retrieved?.state.phase).toBe("planning");

      // Cleanup
      await clearVoiceWorkflowContext(userId);
      const afterClear = await getVoiceWorkflowContext(userId);
      expect(afterClear).toBeUndefined();
    });

    it("checks for active workflow context", async () => {
      const {
        clearVoiceWorkflowContext,
        hasActiveWorkflowContext,
        setVoiceWorkflowContext,
      } = await import("../src/voice/session-context.js");
      const { createExecutingState } = await import(
        "../src/voice/workflow-state.js"
      );

      const userId = "test-user-456";

      // No context = not active
      const beforeSet = await hasActiveWorkflowContext(userId);
      expect(beforeSet).toBe(false);

      // Executing = active
      await setVoiceWorkflowContext(userId, {
        state: createExecutingState("run-xyz"),
        originalTranscript: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const duringExec = await hasActiveWorkflowContext(userId);
      expect(duringExec).toBe(true);

      // Cleanup
      await clearVoiceWorkflowContext(userId);
    });
  });

  describe("heuristic intent classification", () => {
    it("scores workflow keywords correctly", async () => {
      const { _internal } = await import("../src/voice/intent.js");
      const { calculateWorkflowScore } = _internal;

      // Strong workflow signals
      expect(calculateWorkflowScore("build a new feature")).toBeGreaterThan(
        0.3
      );
      expect(calculateWorkflowScore("create an api endpoint")).toBeGreaterThan(
        0.3
      );
      expect(calculateWorkflowScore("fix the bug in auth")).toBeGreaterThan(
        0.3
      );
      expect(
        calculateWorkflowScore("refactor the database module")
      ).toBeGreaterThan(0.3);

      // Weak or no workflow signals
      expect(calculateWorkflowScore("hello how are you")).toBe(0);
      expect(calculateWorkflowScore("what is the weather")).toBe(0);
    });

    it("detects approval keywords", async () => {
      const { _internal } = await import("../src/voice/intent.js");
      const { detectApprovalIntent } = _internal;

      // Approval
      expect(detectApprovalIntent("yes")).toEqual({
        type: "approval",
        action: "approve",
      });
      expect(detectApprovalIntent("approve")).toEqual({
        type: "approval",
        action: "approve",
      });
      expect(detectApprovalIntent("go ahead")).toEqual({
        type: "approval",
        action: "approve",
      });
      expect(detectApprovalIntent("sounds good")).toEqual({
        type: "approval",
        action: "approve",
      });

      // Rejection
      expect(detectApprovalIntent("no")).toEqual({
        type: "approval",
        action: "reject",
      });
      expect(detectApprovalIntent("cancel")).toEqual({
        type: "approval",
        action: "reject",
      });
      expect(detectApprovalIntent("reject")).toEqual({
        type: "approval",
        action: "reject",
      });

      // Neither
      expect(detectApprovalIntent("tell me more")).toBeNull();
    });

    it("detects status keywords", async () => {
      const { _internal } = await import("../src/voice/intent.js");
      const { isStatusQuery } = _internal;

      expect(isStatusQuery("what's the status")).toBe(true);
      expect(isStatusQuery("how's the progress")).toBe(true);
      expect(isStatusQuery("is it done")).toBe(true);
      expect(isStatusQuery("are you finished")).toBe(true);

      expect(isStatusQuery("build a feature")).toBe(false);
      expect(isStatusQuery("hello")).toBe(false);
    });
  });

  describe("clarification formatting", () => {
    it("formats single clarification question", async () => {
      const { clarificationToSpeech } = await import(
        "../src/voice/plan-speech.js"
      );

      const result = clarificationToSpeech([
        {
          question: "Which component should I update?",
          options: ["Header", "Footer", "Sidebar"],
        },
      ]);

      expect(result).toContain("clarify");
      expect(result).toContain("Which component");
      expect(result).toContain("Header");
    });

    it("formats multiple clarification questions", async () => {
      const { clarificationToSpeech } = await import(
        "../src/voice/plan-speech.js"
      );

      const result = clarificationToSpeech([
        { question: "First question?" },
        { question: "Second question?" },
      ]);

      expect(result).toContain("2 questions");
      expect(result).toContain("First");
    });

    it("handles empty questions", async () => {
      const { clarificationToSpeech } = await import(
        "../src/voice/plan-speech.js"
      );

      const result = clarificationToSpeech([]);

      expect(result).toContain("more details");
    });
  });

  describe("completion summary", () => {
    it("formats successful completion", async () => {
      const { planCompletionSummary } = await import(
        "../src/voice/plan-speech.js"
      );

      const plan = {
        id: "test",
        title: "Test",
        intent: "Test",
        phases: [
          {
            id: "p1",
            name: "Phase 1",
            description: "",
            tasks: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
            dependsOn: [],
            estimatedDurationMs: 0,
            agentType: "codex" as const,
          },
        ],
        resources: {
          agentCount: 1,
          strategy: "sequential" as const,
          isolation: "agentfs" as const,
        },
        evaluationCriteria: [],
      };

      const result = planCompletionSummary(
        plan as Parameters<typeof planCompletionSummary>[0],
        true,
        120_000
      );

      expect(result).toContain("Done");
      expect(result).toContain("3 tasks");
      expect(result).toContain("2 minutes");
    });

    it("formats failed completion", async () => {
      const { planCompletionSummary } = await import(
        "../src/voice/plan-speech.js"
      );

      const plan = {
        id: "test",
        title: "Test",
        intent: "Test",
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential" as const,
          isolation: "agentfs" as const,
        },
        evaluationCriteria: [],
      };

      const result = planCompletionSummary(
        plan as Parameters<typeof planCompletionSummary>[0],
        false,
        60_000
      );

      expect(result).toContain("issues");
      expect(result).toContain("web interface");
    });
  });

  describe("verbosity levels", () => {
    const createTestPlan = () => ({
      id: "test-plan",
      title: "Test Plan",
      intent: "Build feature",
      phases: [
        {
          id: "phase-1",
          name: "Backend Setup",
          description: "Initialize the backend infrastructure",
          tasks: [{ id: "t1" }, { id: "t2" }],
          dependsOn: [],
          estimatedDurationMs: 120_000,
          agentType: "codex" as const,
        },
        {
          id: "phase-2",
          name: "Frontend Implementation",
          description: "Build the user interface",
          tasks: [{ id: "t3" }, { id: "t4" }, { id: "t5" }],
          dependsOn: ["phase-1"],
          estimatedDurationMs: 180_000,
          agentType: "codex" as const,
        },
      ],
      resources: {
        agentCount: 2,
        strategy: "sequential" as const,
        isolation: "agentfs" as const,
      },
      evaluationCriteria: [],
    });

    it("brief verbosity is shorter than standard", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");
      const plan = createTestPlan();

      const brief = planToSpeech(plan as Parameters<typeof planToSpeech>[0], {
        verbosity: "brief",
      });
      const standard = planToSpeech(
        plan as Parameters<typeof planToSpeech>[0],
        {
          verbosity: "standard",
        }
      );

      expect(brief.length).toBeLessThan(standard.length);
      expect(brief).toContain("Plan ready");
    });

    it("detailed verbosity includes descriptions", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");
      const plan = createTestPlan();

      const detailed = planToSpeech(
        plan as Parameters<typeof planToSpeech>[0],
        {
          verbosity: "detailed",
        }
      );

      expect(detailed).toContain("Initialize the backend");
    });

    it("standard verbosity shows phase names", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");
      const plan = createTestPlan();

      const standard = planToSpeech(
        plan as Parameters<typeof planToSpeech>[0],
        {
          verbosity: "standard",
        }
      );

      expect(standard).toContain("Backend Setup");
      expect(standard).toContain("Frontend Implementation");
    });
  });

  describe("approval timeout", () => {
    it("calculates approval deadline", async () => {
      const { calculateApprovalDeadline } = await import(
        "../src/voice/workflow-state.js"
      );

      // No timeout (0 minutes)
      const noTimeout = calculateApprovalDeadline(0);
      expect(noTimeout).toBeUndefined();

      // 5 minute timeout
      const fiveMin = calculateApprovalDeadline(5);
      expect(fiveMin).toBeDefined();
      if (fiveMin) {
        const expectedMs = 5 * 60 * 1000;
        const actualMs = fiveMin.getTime() - Date.now();
        // Should be within 1 second of 5 minutes
        expect(actualMs).toBeGreaterThan(expectedMs - 1000);
        expect(actualMs).toBeLessThanOrEqual(expectedMs);
      }
    });

    it("detects expired approval", async () => {
      const { isApprovalExpired, createAwaitingApprovalState } = await import(
        "../src/voice/workflow-state.js"
      );

      const expiredContext = {
        state: createAwaitingApprovalState({
          runId: "run-1",
          planId: "plan-1",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 1,
        }),
        originalTranscript: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalDeadline: new Date(Date.now() - 1000), // 1 second ago
      };

      expect(isApprovalExpired(expiredContext)).toBe(true);

      const validContext = {
        ...expiredContext,
        approvalDeadline: new Date(Date.now() + 60_000), // 1 minute from now
      };

      expect(isApprovalExpired(validContext)).toBe(false);
    });

    it("serializes and deserializes approval deadline", async () => {
      const {
        serializeWorkflowContext,
        deserializeWorkflowContext,
        createAwaitingApprovalState,
      } = await import("../src/voice/workflow-state.js");

      const deadline = new Date(Date.now() + 300_000); // 5 minutes from now
      const context = {
        state: createAwaitingApprovalState({
          runId: "run-1",
          planId: "plan-1",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 1,
        }),
        originalTranscript: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalDeadline: deadline,
      };

      const serialized = serializeWorkflowContext(context);
      const deserialized = deserializeWorkflowContext(serialized);

      expect(deserialized?.approvalDeadline).toBeDefined();
      expect(deserialized?.approvalDeadline?.getTime()).toBe(
        deadline.getTime()
      );
    });
  });

  describe("preference defaults", () => {
    it("provides correct defaults", async () => {
      const { VOICE_WORKFLOW_DEFAULTS } = await import(
        "../src/voice/preferences.js"
      );

      expect(VOICE_WORKFLOW_DEFAULTS.enabled).toBe(true);
      expect(VOICE_WORKFLOW_DEFAULTS.verbosity).toBe("standard");
      expect(VOICE_WORKFLOW_DEFAULTS.autoApprove).toBe("off");
      expect(VOICE_WORKFLOW_DEFAULTS.notifications).toBe("voice");
      expect(VOICE_WORKFLOW_DEFAULTS.updates).toBe("request");
      expect(VOICE_WORKFLOW_DEFAULTS.timeout).toBe(5);
      expect(VOICE_WORKFLOW_DEFAULTS.learning).toBe(true);
    });

    it("has correct preference keys", async () => {
      const { VOICE_WORKFLOW_KEYS } = await import(
        "../src/voice/preferences.js"
      );

      expect(VOICE_WORKFLOW_KEYS.enabled).toBe("domain.voice.workflow_enabled");
      expect(VOICE_WORKFLOW_KEYS.verbosity).toBe(
        "domain.voice.workflow_verbosity"
      );
      expect(VOICE_WORKFLOW_KEYS.autoApprove).toBe(
        "domain.voice.workflow_auto_approve"
      );
      expect(VOICE_WORKFLOW_KEYS.notifications).toBe(
        "domain.voice.workflow_notifications"
      );
      expect(VOICE_WORKFLOW_KEYS.updates).toBe("domain.voice.workflow_updates");
      expect(VOICE_WORKFLOW_KEYS.timeout).toBe("domain.voice.workflow_timeout");
      expect(VOICE_WORKFLOW_KEYS.learning).toBe(
        "domain.voice.workflow_learning"
      );
    });
  });

  describe("notifier", () => {
    it("subscribes and unsubscribes", async () => {
      const {
        subscribeToNotifications,
        getSubscriberCount,
        clearAllSubscribers,
      } = await import("../src/voice/notifier.js");

      const userId = "test-notifier-user";
      clearAllSubscribers();

      expect(getSubscriberCount(userId)).toBe(0);

      const callback = () => {};
      const unsubscribe = subscribeToNotifications(userId, callback);

      expect(getSubscriberCount(userId)).toBe(1);

      unsubscribe();

      expect(getSubscriberCount(userId)).toBe(0);
    });

    it("allows multiple subscribers", async () => {
      const {
        subscribeToNotifications,
        getSubscriberCount,
        clearAllSubscribers,
      } = await import("../src/voice/notifier.js");

      const userId = "test-multi-user";
      clearAllSubscribers();

      const unsubscribe1 = subscribeToNotifications(userId, () => {});
      const unsubscribe2 = subscribeToNotifications(userId, () => {});

      expect(getSubscriberCount(userId)).toBe(2);

      unsubscribe1();
      expect(getSubscriberCount(userId)).toBe(1);

      unsubscribe2();
      expect(getSubscriberCount(userId)).toBe(0);
    });
  });
});
