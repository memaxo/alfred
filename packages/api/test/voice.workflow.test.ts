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
    capabilities: ["genui"],
    model: {},
    modelKey: "test-model",
  }),
  getModelForRole: () => ({
    capabilities: [],
    model: {},
    modelKey: "test-model",
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
    it("degrades safely to conversational when LLM unavailable", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      const classified = await classifyVoiceIntent("build a new api endpoint");
      expect(classified.result.type).toBe("conversational");
      expect(classified.meta.heuristicFallbackUsed).toBe(false);
    });

    it("classifies conversational intent", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      const classified = await classifyVoiceIntent("what time is it");

      expect(classified.result.type).toBe("conversational");
    });

    it("detects approval in awaiting_approval state", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");
      const { createAwaitingApprovalState } =
        await import("../src/voice/workflow-state.js");

      const sessionContext = {
        createdAt: new Date(),
        originalTranscript: "build something",
        state: createAwaitingApprovalState({
          runId: "test-run",
          planId: "test-plan",
          summary: "Test plan",
          waveCount: 2,
          subtaskCount: 5,
        }),
        updatedAt: new Date(),
      };

      const classified = await classifyVoiceIntent("approve", sessionContext);
      expect(classified.result.type).toBe("approval");
      if (classified.result.type === "approval") {
        expect(classified.result.action).toBe("approve");
      }
      expect(classified.meta.heuristicFallbackUsed).toBe(true);
    });

    it("detects rejection in awaiting_approval state", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");
      const { createAwaitingApprovalState } =
        await import("../src/voice/workflow-state.js");

      const sessionContext = {
        createdAt: new Date(),
        originalTranscript: "build something",
        state: createAwaitingApprovalState({
          runId: "test-run",
          planId: "test-plan",
          summary: "Test plan",
          waveCount: 2,
          subtaskCount: 5,
        }),
        updatedAt: new Date(),
      };

      const classified = await classifyVoiceIntent("reject", sessionContext);
      expect(classified.result.type).toBe("approval");
      if (classified.result.type === "approval") {
        expect(classified.result.action).toBe("reject");
      }
      expect(classified.meta.heuristicFallbackUsed).toBe(true);
    });

    it("does not guess status via keywords when LLM unavailable", async () => {
      const { classifyVoiceIntent } = await import("../src/voice/intent.js");

      const classified = await classifyVoiceIntent("what's the status");

      expect(classified.result.type).toBe("conversational");
      expect(classified.meta.heuristicFallbackUsed).toBe(false);
    });
  });

  describe("plan-to-speech conversion", () => {
    it("converts simple plan to speech", async () => {
      const { planToSpeech } = await import("../src/voice/plan-speech.js");

      const plan = {
        evaluationCriteria: [],
        id: "test-plan",
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
        title: "Test Plan",
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
        evaluationCriteria: [],
        id: "test-plan",
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
        resources: {
          agentCount: 3,
          strategy: "topological" as const,
          isolation: "agentfs" as const,
        },
        title: "Complex Plan",
        waves: [
          { id: "w1", agents: ["t1", "t2"], dependsOn: [] },
          { id: "w2", agents: ["t3", "t4", "t5"], dependsOn: ["w1"] },
          { id: "w3", agents: ["t6"], dependsOn: ["w2"] },
        ],
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
        evaluationCriteria: [],
        id: "test-plan",
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
        title: "Timed Plan",
      };

      const speech = planToSpeech(plan as Parameters<typeof planToSpeech>[0]);

      expect(speech).toContain("5 minutes");
    });
  });

  describe("workflow state machine", () => {
    it("creates idle state", async () => {
      const { createIdleState } =
        await import("../src/voice/workflow-state.js");

      const state = createIdleState();

      expect(state.phase).toBe("idle");
    });

    it("creates planning state", async () => {
      const { createPlanningState } =
        await import("../src/voice/workflow-state.js");

      const state = createPlanningState("run-123");

      expect(state.phase).toBe("planning");
      expect(state.runId).toBe("run-123");
    });

    it("creates awaiting approval state", async () => {
      const { createAwaitingApprovalState } =
        await import("../src/voice/workflow-state.js");

      const state = createAwaitingApprovalState({
        planId: "plan-456",
        runId: "run-123",
        subtaskCount: 5,
        summary: "Test plan summary",
        waveCount: 2,
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
      const { createExecutingState } =
        await import("../src/voice/workflow-state.js");

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
        createdAt: new Date(),
        originalTranscript: "build a feature",
        state: createAwaitingApprovalState({
          runId: "run-123",
          planId: "plan-456",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 3,
        }),
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
      const { createPlanningState } =
        await import("../src/voice/workflow-state.js");

      const userId = "test-user-123";
      const context = {
        createdAt: new Date(),
        originalTranscript: "test request",
        state: createPlanningState("run-abc"),
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
      const { createExecutingState } =
        await import("../src/voice/workflow-state.js");

      const userId = "test-user-456";

      // No context = not active
      const beforeSet = await hasActiveWorkflowContext(userId);
      expect(beforeSet).toBe(false);

      // Executing = active
      await setVoiceWorkflowContext(userId, {
        createdAt: new Date(),
        originalTranscript: "test",
        state: createExecutingState("run-xyz"),
        updatedAt: new Date(),
      });

      const duringExec = await hasActiveWorkflowContext(userId);
      expect(duringExec).toBe(true);

      // Cleanup
      await clearVoiceWorkflowContext(userId);
    });
  });

  describe("minimal heuristic fallback", () => {
    it("only matches exact approve/reject tokens", async () => {
      const { _internal } = await import("../src/voice/intent.js");
      const { detectApprovalFallback } = _internal;

      expect(detectApprovalFallback("approve")).toEqual({
        action: "approve",
        type: "approval",
      });
      expect(detectApprovalFallback("reject")).toEqual({
        action: "reject",
        type: "approval",
      });
      expect(detectApprovalFallback("yes")).toEqual({
        action: "approve",
        type: "approval",
      });
      expect(detectApprovalFallback("no")).toEqual({
        action: "reject",
        type: "approval",
      });

      expect(detectApprovalFallback("yes, approve it")).toBeNull();
      expect(detectApprovalFallback("what's the status")).toBeNull();
      expect(detectApprovalFallback("build a feature")).toBeNull();
    });
  });

  describe("clarification formatting", () => {
    it("formats single clarification question", async () => {
      const { clarificationToSpeech } =
        await import("../src/voice/plan-speech.js");

      const result = clarificationToSpeech([
        {
          options: ["Header", "Footer", "Sidebar"],
          question: "Which component should I update?",
        },
      ]);

      expect(result).toContain("clarify");
      expect(result).toContain("Which component");
      expect(result).toContain("Header");
    });

    it("formats multiple clarification questions", async () => {
      const { clarificationToSpeech } =
        await import("../src/voice/plan-speech.js");

      const result = clarificationToSpeech([
        { question: "First question?" },
        { question: "Second question?" },
      ]);

      expect(result).toContain("2 questions");
      expect(result).toContain("First");
    });

    it("handles empty questions", async () => {
      const { clarificationToSpeech } =
        await import("../src/voice/plan-speech.js");

      const result = clarificationToSpeech([]);

      expect(result).toContain("more details");
    });
  });

  describe("completion summary", () => {
    it("formats successful completion", async () => {
      const { planCompletionSummary } =
        await import("../src/voice/plan-speech.js");

      const plan = {
        evaluationCriteria: [],
        id: "test",
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
        title: "Test",
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
      const { planCompletionSummary } =
        await import("../src/voice/plan-speech.js");

      const plan = {
        evaluationCriteria: [],
        id: "test",
        intent: "Test",
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential" as const,
          isolation: "agentfs" as const,
        },
        title: "Test",
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
      evaluationCriteria: [],
      id: "test-plan",
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
      title: "Test Plan",
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
      const { calculateApprovalDeadline } =
        await import("../src/voice/workflow-state.js");

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
      const { isApprovalExpired, createAwaitingApprovalState } =
        await import("../src/voice/workflow-state.js");

      const expiredContext = {
        approvalDeadline: new Date(Date.now() - 1000),
        createdAt: new Date(),
        originalTranscript: "test",
        state: createAwaitingApprovalState({
          runId: "run-1",
          planId: "plan-1",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 1,
        }),
        updatedAt: new Date(), // 1 second ago
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
        approvalDeadline: deadline,
        createdAt: new Date(),
        originalTranscript: "test",
        state: createAwaitingApprovalState({
          runId: "run-1",
          planId: "plan-1",
          summary: "Test",
          waveCount: 1,
          subtaskCount: 1,
        }),
        updatedAt: new Date(),
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
      const { VOICE_WORKFLOW_DEFAULTS } =
        await import("../src/voice/preferences.js");

      expect(VOICE_WORKFLOW_DEFAULTS.enabled).toBe(true);
      expect(VOICE_WORKFLOW_DEFAULTS.verbosity).toBe("standard");
      expect(VOICE_WORKFLOW_DEFAULTS.autoApprove).toBe("off");
      expect(VOICE_WORKFLOW_DEFAULTS.notifications).toBe("voice");
      expect(VOICE_WORKFLOW_DEFAULTS.updates).toBe("request");
      expect(VOICE_WORKFLOW_DEFAULTS.timeout).toBe(5);
      expect(VOICE_WORKFLOW_DEFAULTS.learning).toBe(true);
    });

    it("has correct preference keys", async () => {
      const { VOICE_WORKFLOW_KEYS } =
        await import("../src/voice/preferences.js");

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
