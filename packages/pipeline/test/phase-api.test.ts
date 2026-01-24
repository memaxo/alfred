/**
 * Tests for Pipeline Phase APIs
 *
 * Tests the new phase-level execution capabilities:
 * - runUntilStage() for partial pipeline execution
 * - runStage() for single-stage execution
 * - Snapshot utilities for extracting stage inputs/outputs
 * - Zod schemas for phase I/O validation
 */

import { describe, expect, it } from "bun:test";

import type { PipelineEvent } from "../src/events";
import type { PipelineContext, PipelineStage } from "../src/pipeline";

import { DEFAULT_CONFIG, STAGE_ORDER } from "../src/pipeline";
import { PipelineRunner } from "../src/runner";
import {
  executePhaseInputSchema,
  phaseStatusSchema,
  planPhaseInputSchema,
  planPhaseOutputSchema,
  subTaskSchema,
  wavePlanSchema,
} from "../src/schemas";
import {
  createContextFromSnapshot,
  createInitialSnapshot,
  extractStageInput,
  extractStageOutput,
  getNextStage,
  getPreviousStage,
  getResumeStage,
  hasCompletedStage,
  type PipelineSnapshot,
} from "../src/snapshot";

// --- Test Helpers ---

function createMockStage<TInput, TOutput>(
  name: (typeof STAGE_ORDER)[number],
  transform: (input: TInput) => TOutput
): PipelineStage<TInput, TOutput> {
  return {
    name,
    execute: async (input: TInput, _ctx: PipelineContext) => transform(input),
  };
}

function createMockContext(
  overrides: Partial<PipelineContext> = {}
): PipelineContext {
  const storage = new Map<string, unknown>();
  return {
    runId: "test-run",
    requirement: "test requirement",
    workspace: "/test/workspace",
    userId: "test-user",
    signal: new AbortController().signal,
    config: DEFAULT_CONFIG,
    emit: () => {},
    get: <T>(key: string) => storage.get(key) as T | undefined,
    set: (key: string, value: unknown) => storage.set(key, value),
    ...overrides,
  };
}

// --- Snapshot Utility Tests ---

describe("Snapshot Utilities", () => {
  describe("getPreviousStage", () => {
    it("returns null for init (first stage)", () => {
      expect(getPreviousStage("init")).toBeNull();
    });

    it("returns init for context", () => {
      expect(getPreviousStage("context")).toBe("init");
    });

    it("returns context for plan", () => {
      expect(getPreviousStage("plan")).toBe("context");
    });

    it("returns schedule for execute", () => {
      expect(getPreviousStage("execute")).toBe("schedule");
    });
  });

  describe("getNextStage", () => {
    it("returns context for init", () => {
      expect(getNextStage("init")).toBe("context");
    });

    it("returns plan for context", () => {
      expect(getNextStage("context")).toBe("plan");
    });

    it("returns null for summarize (last stage)", () => {
      expect(getNextStage("summarize")).toBeNull();
    });
  });

  describe("extractStageOutput", () => {
    it("extracts stage output from snapshot", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "init",
        lastCompletedStageIndex: 0,
        contextEntries: [["initOutput", { projectId: "proj-1" }]],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const output = extractStageOutput<{ projectId: string }>(
        snapshot,
        "init"
      );

      expect(output).toEqual({ projectId: "proj-1" });
    });

    it("returns null for missing output", () => {
      const snapshot = createInitialSnapshot();

      const output = extractStageOutput(snapshot, "init");

      expect(output).toBeNull();
    });
  });

  describe("extractStageInput", () => {
    it("extracts input from previous stage output", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "context",
        lastCompletedStageIndex: 1,
        contextEntries: [
          ["initOutput", { projectId: "proj-1" }],
          ["contextOutput", { bundle: {}, receipts: {} }],
        ],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      // Input for plan stage is contextOutput
      const input = extractStageInput<{ bundle: object; receipts: object }>(
        snapshot,
        "plan"
      );

      expect(input).toEqual({ bundle: {}, receipts: {} });
    });

    it("returns null for init stage (no previous)", () => {
      const snapshot = createInitialSnapshot();

      const input = extractStageInput(snapshot, "init");

      expect(input).toBeNull();
    });
  });

  describe("hasCompletedStage", () => {
    it("returns true for completed stages", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "plan",
        lastCompletedStageIndex: 2,
        contextEntries: [],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      expect(hasCompletedStage(snapshot, "init")).toBe(true);
      expect(hasCompletedStage(snapshot, "context")).toBe(true);
      expect(hasCompletedStage(snapshot, "plan")).toBe(true);
    });

    it("returns false for uncompleted stages", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "plan",
        lastCompletedStageIndex: 2,
        contextEntries: [],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      expect(hasCompletedStage(snapshot, "schedule")).toBe(false);
      expect(hasCompletedStage(snapshot, "execute")).toBe(false);
    });
  });

  describe("getResumeStage", () => {
    it("returns next uncompleted stage", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "suspended",
        requirement: "test",
        lastCompletedStage: "schedule",
        lastCompletedStageIndex: 3,
        contextEntries: [],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      expect(getResumeStage(snapshot)).toBe("execute");
    });

    it("returns null when all stages completed", () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "completed",
        requirement: "test",
        lastCompletedStage: "summarize",
        lastCompletedStageIndex: 7,
        contextEntries: [],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      expect(getResumeStage(snapshot)).toBeNull();
    });

    it("returns init when nothing completed", () => {
      const snapshot = createInitialSnapshot();

      expect(getResumeStage(snapshot)).toBe("init");
    });
  });
});

// --- Schema Validation Tests ---

describe("Phase Schemas", () => {
  describe("subTaskSchema", () => {
    it("validates valid subtask", () => {
      const subtask = {
        id: "task-1",
        title: "Test Task",
        requirement: "Do something",
        deps: ["task-0"],
        priority: 1,
        acceptance: ["Test passes"],
        filesHint: ["src/main.ts"],
      };

      const result = subTaskSchema.safeParse(subtask);

      expect(result.success).toBe(true);
    });

    it("rejects invalid subtask", () => {
      const subtask = {
        id: "task-1",
        // missing title
        requirement: "Do something",
      };

      const result = subTaskSchema.safeParse(subtask);

      expect(result.success).toBe(false);
    });
  });

  describe("wavePlanSchema", () => {
    it("validates valid wave plan", () => {
      const wave = {
        id: "wave-1",
        agents: ["task-1", "task-2"],
        dependsOn: [],
        agentType: "codex",
        phaseId: "phase-1",
      };

      const result = wavePlanSchema.safeParse(wave);

      expect(result.success).toBe(true);
    });

    it("validates minimal wave plan", () => {
      const wave = {
        id: "wave-1",
        agents: ["task-1"],
        dependsOn: [],
      };

      const result = wavePlanSchema.safeParse(wave);

      expect(result.success).toBe(true);
    });
  });

  describe("planPhaseInputSchema", () => {
    it("validates valid input", () => {
      const input = {
        requirement: "Build a feature",
        workspace: "/path/to/repo",
        userId: "user-123",
      };

      const result = planPhaseInputSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("validates input with optional fields", () => {
      const input = {
        runId: "run-123",
        requirement: "Build a feature",
        workspace: "/path/to/repo",
        userId: "user-123",
        authz: "token",
        linear: {
          space: "ALFRED",
          sessionId: "session-1",
        },
      };

      const result = planPhaseInputSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects empty requirement", () => {
      const input = {
        requirement: "",
        workspace: "/path/to/repo",
        userId: "user-123",
      };

      const result = planPhaseInputSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("executePhaseInputSchema", () => {
    it("validates valid execute input", () => {
      const input = {
        runId: "run-123",
        waves: [{ id: "wave-1", agents: ["task-1"], dependsOn: [] }],
        subtasks: [
          {
            id: "task-1",
            title: "Task",
            requirement: "Do it",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        execPlans: { "task-1": "/path/to/plan.md" },
        rootPlanPath: "/path/to/root.md",
        workspace: "/repo",
        userId: "user-123",
      };

      const result = executePhaseInputSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts waveIds and skipTaskIds", () => {
      const input = {
        runId: "run-123",
        waves: [{ id: "wave-1", agents: ["task-1"], dependsOn: [] }],
        subtasks: [
          {
            id: "task-1",
            title: "Task",
            requirement: "Do it",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        execPlans: { "task-1": "/path/to/plan.md" },
        rootPlanPath: "/path/to/root.md",
        workspace: "/repo",
        userId: "user-123",
        waveIds: ["wave-1"],
        skipTaskIds: ["task-1"],
      };

      const result = executePhaseInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.waveIds).toEqual(["wave-1"]);
        expect(result.data.skipTaskIds).toEqual(["task-1"]);
      }
    });

    it("defaults dryRun to false when omitted", () => {
      const input = {
        runId: "run-123",
        waves: [{ id: "wave-1", agents: ["task-1"], dependsOn: [] }],
        subtasks: [
          {
            id: "task-1",
            title: "Task",
            requirement: "Do it",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        execPlans: { "task-1": "/path/to/plan.md" },
        rootPlanPath: "/path/to/root.md",
        workspace: "/repo",
        userId: "user-123",
      };

      const result = executePhaseInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false);
      }
    });

    it("accepts dryRun=true", () => {
      const input = {
        runId: "run-123",
        waves: [{ id: "wave-1", agents: ["task-1"], dependsOn: [] }],
        subtasks: [
          {
            id: "task-1",
            title: "Task",
            requirement: "Do it",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        execPlans: { "task-1": "/path/to/plan.md" },
        rootPlanPath: "/path/to/root.md",
        workspace: "/repo",
        userId: "user-123",
        dryRun: true,
      };

      const result = executePhaseInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
      }
    });
  });

  describe("planPhaseOutputSchema", () => {
    it("validates valid output", () => {
      const output = {
        runId: "run-123",
        planId: "plan-123",
        structuredPlan: {
          id: "plan-123",
          title: "Test plan",
          intent: "test",
          workspace: "/workspace",
          phases: [],
          resources: {
            agentCount: 1,
            strategy: "sequential",
            isolation: "agentfs",
          },
          evaluationCriteria: [],
        },
        waves: [{ id: "wave-1", agents: ["task-1"], dependsOn: [] }],
        waveCount: 1,
        subtasks: [
          {
            id: "task-1",
            title: "Task",
            requirement: "Do it",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        execPlans: { "task-1": "/path/to/plan.md" },
        rootPlanPath: "/path/to/root.md",
        executionMode: "sequential" as const,
        estimatedDuration: 60_000,
        snapshot: {
          runId: "run-123",
          status: "suspended" as const,
          requirement: "test",
          lastCompletedStage: "schedule" as const,
          lastCompletedStageIndex: 3,
          startedAt: Date.now(),
          lastEventAt: Date.now(),
          error: null,
        },
      };

      const result = planPhaseOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("phaseStatusSchema", () => {
    it("validates phase status", () => {
      const status = {
        runId: "run-123",
        status: "suspended" as const,
        lastCompletedStage: "schedule" as const,
        lastCompletedStageIndex: 3,
        stageResults: [
          { name: "init", durationMs: 100, status: "success" as const },
        ],
        error: null,
        canResume: true,
        nextStage: "execute" as const,
      };

      const result = phaseStatusSchema.safeParse(status);

      expect(result.success).toBe(true);
    });
  });
});

// --- PipelineRunner Method Tests ---

describe("PipelineRunner Phase Methods", () => {
  describe("runStage", () => {
    it("executes a single stage", async () => {
      const runner = new PipelineRunner();
      const mockStage = createMockStage<number, number>("init", (n) => n * 2);
      runner.registerStage(mockStage);

      const ctx = createMockContext();
      const result = await runner.runStage<number, number>("init", 5, ctx);

      expect(result).toBe(10);
    });

    it("stores output in context", async () => {
      const runner = new PipelineRunner();
      const mockStage = createMockStage<string, { value: string }>(
        "init",
        (s) => ({ value: s })
      );
      runner.registerStage(mockStage);

      const ctx = createMockContext();
      await runner.runStage("init", "test", ctx);

      expect(ctx.get<{ value: string }>("initOutput")).toEqual({
        value: "test",
      });
    });

    it("throws for unregistered stage", async () => {
      const runner = new PipelineRunner();
      const ctx = createMockContext();

      await expect(runner.runStage("init", {}, ctx)).rejects.toThrow(
        "Stage not registered: init"
      );
    });

    it("respects abort signal", async () => {
      const runner = new PipelineRunner();
      const mockStage = createMockStage("init", (x) => x);
      runner.registerStage(mockStage);

      const abortController = new AbortController();
      abortController.abort();

      const ctx = createMockContext({
        signal: abortController.signal,
      });

      await expect(
        runner.runStage("init", {}, ctx, abortController.signal)
      ).rejects.toThrow("pipeline_aborted");
    });
  });

  describe("runUntilStage", () => {
    it("stops at specified stage", async () => {
      const runner = new PipelineRunner();
      const stages: string[] = [];

      // Register mock stages that track execution
      for (const stageName of STAGE_ORDER) {
        const stage = createMockStage(stageName, (input) => {
          stages.push(stageName);
          return { ...(input as object), stage: stageName };
        });
        runner.registerStage(stage);
      }

      const input = {
        runId: "test-run",
        requirement: "test",
        workspace: "/test",
        userId: "user-1",
      };

      const events: PipelineEvent[] = [];
      for await (const event of runner.runUntilStage(input, "schedule")) {
        events.push(event);
      }

      // Should have executed init, context, plan, schedule
      expect(stages).toEqual(["init", "context", "plan", "schedule"]);

      // Should NOT have executed execute, review, learn, summarize
      expect(stages).not.toContain("execute");
      expect(stages).not.toContain("review");
    });

    it("emits suspend event at boundary", async () => {
      const runner = new PipelineRunner();

      for (const stageName of STAGE_ORDER) {
        runner.registerStage(createMockStage(stageName, (x) => x));
      }

      const input = {
        runId: "test-run",
        requirement: "test",
        workspace: "/test",
        userId: "user-1",
      };

      const events: PipelineEvent[] = [];
      for await (const event of runner.runUntilStage(input, "init")) {
        events.push(event);
      }

      const suspendEvent = events.find((e) => e.type === "pipeline:suspend");
      expect(suspendEvent).toBeDefined();
      expect((suspendEvent as { reason?: string })?.reason).toBe(
        "stage_boundary"
      );
    });

    it("throws for unknown stage", async () => {
      const runner = new PipelineRunner();

      const input = {
        runId: "test-run",
        requirement: "test",
        workspace: "/test",
        userId: "user-1",
      };

      let threw = false;
      try {
        for await (const _event of runner.runUntilStage(
          input,
          "unknown" as (typeof STAGE_ORDER)[number]
        )) {
          // consume
        }
      } catch (error) {
        threw = true;
        expect((error as Error).message).toBe("Unknown stage: unknown");
      }
      expect(threw).toBe(true);
    });

    it("returns output of final stage", async () => {
      const runner = new PipelineRunner();

      runner.registerStage(createMockStage("init", () => ({ step: 1 })));
      runner.registerStage(createMockStage("context", () => ({ step: 2 })));

      const input = {
        runId: "test-run",
        requirement: "test",
        workspace: "/test",
        userId: "user-1",
      };

      const events: PipelineEvent[] = [];
      for await (const event of runner.runUntilStage(input, "context")) {
        events.push(event);
      }

      // Check that context stage was the last one executed via events
      const contextExitEvent = events.find(
        (e) => e.type === "stage:exit" && e.stage === "context"
      );
      expect(contextExitEvent).toBeDefined();
    });
  });
});

// --- createContextFromSnapshot Tests ---

describe("createContextFromSnapshot", () => {
  it("creates context with snapshot values", () => {
    const snapshot: PipelineSnapshot = {
      runId: "run-123",
      status: "suspended",
      requirement: "test requirement",
      lastCompletedStage: "plan",
      lastCompletedStageIndex: 2,
      contextEntries: [
        ["workspace", "/test/workspace"],
        ["userId", "user-123"],
        ["customKey", "customValue"],
      ],
      stageResults: [],
      startedAt: Date.now(),
      lastEventAt: Date.now(),
      lastEventId: null,
      error: null,
    };

    const events: PipelineEvent[] = [];
    const ctx = createContextFromSnapshot(snapshot, {
      emit: (event) => events.push(event),
    });

    expect(ctx.runId).toBe("run-123");
    expect(ctx.requirement).toBe("test requirement");
    expect(ctx.get<string>("customKey")).toBe("customValue");
  });

  it("uses workspace from context entries", () => {
    const snapshot: PipelineSnapshot = {
      runId: "run-123",
      status: "suspended",
      requirement: "test",
      lastCompletedStage: "init",
      lastCompletedStageIndex: 0,
      contextEntries: [["workspace", "/custom/workspace"]],
      stageResults: [],
      startedAt: Date.now(),
      lastEventAt: Date.now(),
      lastEventId: null,
      error: null,
    };

    const ctx = createContextFromSnapshot(snapshot, {
      emit: () => {},
    });

    expect(ctx.workspace).toBe("/custom/workspace");
  });

  it("accepts custom config", () => {
    const snapshot: PipelineSnapshot = {
      runId: "run-123",
      status: "suspended",
      requirement: "test",
      lastCompletedStage: "init",
      lastCompletedStageIndex: 0,
      contextEntries: [],
      stageResults: [],
      startedAt: Date.now(),
      lastEventAt: Date.now(),
      lastEventId: null,
      error: null,
    };

    const ctx = createContextFromSnapshot(snapshot, {
      emit: () => {},
      config: { maxParallel: 4 },
    });

    expect(ctx.config.maxParallel).toBe(4);
  });
});
