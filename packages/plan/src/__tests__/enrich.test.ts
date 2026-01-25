/**
 * Unit tests for Task Enrichment query and application.
 *
 * Tests queryTaskEnrichment, applyEnrichmentToTask, and generateResolutionDelta.
 */

import type {
  FailureContext,
  RelevantHeuristic,
  SimilarExecution,
  StructuredHandoff,
  TaskEnrichment,
  UpstreamFailure,
} from "@alfred/type";
import type { SubTask } from "@alfred/type/plan";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

let prevEnrichmentEnv: string | undefined;

beforeAll(() => {
  prevEnrichmentEnv = process.env.ALFRED_ENRICHMENT;
  process.env.ALFRED_ENRICHMENT = "1";
});

afterAll(() => {
  if (prevEnrichmentEnv === undefined) {
    delete process.env.ALFRED_ENRICHMENT;
  } else {
    process.env.ALFRED_ENRICHMENT = prevEnrichmentEnv;
  }
});

// Mock @alfred/db to avoid DB dependency
mock.module("@alfred/db/repo/codex-learning", () => ({
  findRelevantHeuristics: vi.fn().mockResolvedValue([]),
  findSimilarCodexExecutions: vi.fn().mockResolvedValue([]),
}));

// Mock AI SDK for generateResolutionDelta
mock.module("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      category: "deps",
      delta: "Fixed by adding missing import statement",
      keyInsight: "Check imports when module not found errors occur",
    },
  }),
}));

mock.module("@ai-sdk/cerebras", () => ({
  cerebras: vi.fn().mockReturnValue({}),
}));

// Import after mocks
const {
  addHandoffContext,
  addUpstreamFailures,
  applyEnrichmentToTask,
  enrichTasks,
  generateResolutionDelta,
  queryTaskEnrichment,
} = await import("../enrich/index.js");

// Import type separately
import type { EnrichmentSource } from "../enrich/index.js";

// Test fixtures
function createSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "task-1",
    requirement: "Implement user authentication",
    dependencies: [],
    ...overrides,
  };
}

function createSimilarExecution(
  overrides: Partial<SimilarExecution> = {}
): SimilarExecution {
  return {
    runId: "run-123",
    taskId: "task-old",
    status: "completed",
    summary: "Implemented OAuth authentication successfully",
    similarity: 0.85,
    ...overrides,
  };
}

function createHeuristic(
  overrides: Partial<RelevantHeuristic> = {}
): RelevantHeuristic {
  return {
    rule: "Always validate user input before processing",
    severity: "high",
    domain: "security",
    ...overrides,
  };
}

function createFailureContext(
  overrides: Partial<FailureContext> = {}
): FailureContext {
  return {
    taskId: "task-1",
    runId: "run-123",
    status: "failure",
    toolErrors: [
      {
        count: 2,
        error: "Command failed",
        lastOccurrence: Date.now(),
        tool: "shell",
      },
    ],
    loopDetections: [],
    escalations: [],
    reviewFailures: [],
    durationMs: 5000,
    ts: Date.now(),
    ...overrides,
  };
}

function createHandoff(
  overrides: Partial<StructuredHandoff> = {}
): StructuredHandoff {
  return {
    summary: "Wave 1 completed with partial success",
    fromWaveId: "wave-1",
    fromTaskIds: ["task-1"],
    filesModified: ["src/auth.ts"],
    filesCreated: [],
    filesDeleted: [],
    decisions: [{ decision: "Use JWT", rationale: "Industry standard" }],
    toolsAvoided: [{ reason: "Destructive operation", tool: "rm" }],
    openQuestions: [],
    blockers: ["Database connection timeout"],
    ts: Date.now(),
    ...overrides,
  };
}

describe("Task Enrichment", () => {
  describe("queryTaskEnrichment", () => {
    it("should query enrichment from provided source", async () => {
      const mockSource: EnrichmentSource = {
        queryExecutions: vi
          .fn()
          .mockResolvedValue([
            createSimilarExecution({ similarity: 0.9 }),
            createSimilarExecution({ similarity: 0.7 }),
          ]),
        queryHeuristics: vi
          .fn()
          .mockResolvedValue([createHeuristic({ rule: "Heuristic 1" })]),
      };

      const task = createSubTask();
      const enrichment = await queryTaskEnrichment(
        task,
        { resource: "repo/test", runId: "run-123" },
        mockSource
      );

      expect(mockSource.queryExecutions).toHaveBeenCalledWith(
        "repo/test",
        task.requirement,
        3 // default maxSimilarExecutions
      );
      expect(mockSource.queryHeuristics).toHaveBeenCalledWith(
        task.requirement,
        5 // default maxHeuristics
      );
      expect(enrichment.similarExecutions).toHaveLength(2);
      expect(enrichment.relevantHeuristics).toHaveLength(1);
      expect(enrichment.taskId).toBe("task-1");
    });

    it("should respect limit options", async () => {
      const mockSource: EnrichmentSource = {
        queryExecutions: vi.fn().mockResolvedValue([]),
        queryHeuristics: vi.fn().mockResolvedValue([]),
      };

      const task = createSubTask();
      await queryTaskEnrichment(
        task,
        {
          maxHeuristics: 20,
          maxSimilarExecutions: 10,
          resource: "repo/test",
          runId: "run-123",
        },
        mockSource
      );

      expect(mockSource.queryExecutions).toHaveBeenCalledWith(
        "repo/test",
        task.requirement,
        10
      );
      expect(mockSource.queryHeuristics).toHaveBeenCalledWith(
        task.requirement,
        20
      );
    });

    it("should handle source errors gracefully", async () => {
      const mockSource: EnrichmentSource = {
        queryExecutions: vi.fn().mockRejectedValue(new Error("DB error")),
        queryHeuristics: vi.fn().mockRejectedValue(new Error("DB error")),
      };

      const task = createSubTask();
      const enrichment = await queryTaskEnrichment(
        task,
        { resource: "repo/test", runId: "run-123" },
        mockSource
      );

      // Should return empty enrichment on error
      expect(enrichment.similarExecutions).toHaveLength(0);
      expect(enrichment.relevantHeuristics).toHaveLength(0);
    });

    it("should return empty enrichment when no source available", async () => {
      const task = createSubTask();
      // Don't provide source, and DB import will fail
      const enrichment = await queryTaskEnrichment(task, {
        resource: "repo/test",
        runId: "run-123",
      });

      expect(enrichment.taskId).toBe("task-1");
      expect(enrichment.similarExecutions).toHaveLength(0);
    });
  });

  describe("applyEnrichmentToTask", () => {
    it("should inject enrichment into task requirement", () => {
      const task = createSubTask({ requirement: "Original requirement" });
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [createHeuristic()],
        similarExecutions: [createSimilarExecution()],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.requirement).toContain("Original requirement");
      expect(enrichedTask.requirement).toContain("Context from Prior Runs");
      expect(enrichedTask.requirement).toContain("Prior Similar Tasks");
      expect(enrichedTask.requirement).toContain("Learned Heuristics");
    });

    it("should include upstream failures in enrichment", () => {
      const task = createSubTask();
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [
          {
            taskId: "dep-1",
            summary: "Dependency failed with timeout",
            toolsToAvoid: ["shell", "http"],
          },
        ],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.requirement).toContain("Upstream Task Failures");
      expect(enrichedTask.requirement).toContain("dep-1");
      expect(enrichedTask.requirement).toContain("Avoid tools: shell, http");
    });

    it("should include handoff context when present", () => {
      const task = createSubTask();
      const enrichment: TaskEnrichment = {
        handoffContext: createHandoff(),
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.requirement).toContain("Handoff from Previous Wave");
      expect(enrichedTask.requirement).toContain("Decisions Made");
      expect(enrichedTask.requirement).toContain("Use JWT");
      expect(enrichedTask.requirement).toContain("Tools to Avoid");
      expect(enrichedTask.requirement).toContain("Known Blockers");
    });

    it("should return unchanged task when no enrichment data", () => {
      const task = createSubTask({ requirement: "Original" });
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.requirement).toBe("Original");
    });

    it("should add enrichment metadata to task", () => {
      const task = createSubTask();
      const enrichment: TaskEnrichment = {
        handoffContext: createHandoff(),
        relevantHeuristics: [createHeuristic(), createHeuristic()],
        similarExecutions: [createSimilarExecution()],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [
          { taskId: "dep-1", summary: "Failed", toolsToAvoid: [] },
        ],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.metadata?.enrichedAt).toBeDefined();
      expect(enrichedTask.metadata?.enrichmentSources).toEqual({
        hasHandoff: true,
        heuristics: 2,
        similarExecutions: 1,
        upstreamFailures: 1,
      });
    });

    it("should display severity icons correctly", () => {
      const task = createSubTask();
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [
          createHeuristic({ severity: "high", rule: "High severity rule" }),
          createHeuristic({ severity: "medium", rule: "Medium severity rule" }),
          createHeuristic({ severity: "low", rule: "Low severity rule" }),
        ],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const enrichedTask = applyEnrichmentToTask(task, enrichment);

      expect(enrichedTask.requirement).toContain("[⚠/");
      expect(enrichedTask.requirement).toContain("[!/");
      expect(enrichedTask.requirement).toContain("[i/");
    });
  });

  describe("addUpstreamFailures", () => {
    it("should add upstream failures from dependency map", () => {
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const failures = new Map<string, FailureContext>([
        ["dep-1", createFailureContext({ status: "failure", taskId: "dep-1" })],
        [
          "dep-2",
          createFailureContext({
            status: "stuck",
            stuckReason: "Loop detected",
            taskId: "dep-2",
          }),
        ],
      ]);

      const updated = addUpstreamFailures(enrichment, failures, [
        "dep-1",
        "dep-2",
      ]);

      expect(updated.upstreamFailures).toHaveLength(2);
      expect(updated.upstreamFailures[0].taskId).toBe("dep-1");
      expect(updated.upstreamFailures[1].taskId).toBe("dep-2");
      expect(updated.upstreamFailures[1].summary).toContain("Loop detected");
    });

    it("should extract tools to avoid from high-frequency failures", () => {
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const failures = new Map<string, FailureContext>([
        [
          "dep-1",
          createFailureContext({
            taskId: "dep-1",
            toolErrors: [
              {
                count: 3,
                error: "Failed",
                lastOccurrence: Date.now(),
                tool: "shell",
              },
              {
                count: 1,
                error: "Failed",
                lastOccurrence: Date.now(),
                tool: "read",
              },
            ],
          }),
        ],
      ]);

      const updated = addUpstreamFailures(enrichment, failures, ["dep-1"]);

      expect(updated.upstreamFailures[0].toolsToAvoid).toContain("shell");
      expect(updated.upstreamFailures[0].toolsToAvoid).not.toContain("read"); // count < 2
    });

    it("should skip dependencies not in failure map", () => {
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const failures = new Map<string, FailureContext>([
        ["dep-1", createFailureContext({ taskId: "dep-1" })],
      ]);

      const updated = addUpstreamFailures(enrichment, failures, [
        "dep-1",
        "dep-2",
        "dep-3",
      ]);

      expect(updated.upstreamFailures).toHaveLength(1);
    });
  });

  describe("addHandoffContext", () => {
    it("should add handoff context to enrichment", () => {
      const enrichment: TaskEnrichment = {
        relevantHeuristics: [],
        similarExecutions: [],
        taskId: "task-1",
        ts: Date.now(),
        upstreamFailures: [],
      };

      const handoff = createHandoff();
      const updated = addHandoffContext(enrichment, handoff);

      expect(updated.handoffContext).toBeDefined();
      expect(updated.handoffContext?.fromWaveId).toBe("wave-1");
    });
  });

  describe("enrichTasks", () => {
    it("should enrich multiple tasks in parallel", async () => {
      const mockSource: EnrichmentSource = {
        queryExecutions: vi.fn().mockResolvedValue([createSimilarExecution()]),
        queryHeuristics: vi.fn().mockResolvedValue([createHeuristic()]),
      };

      const tasks = [
        createSubTask({ id: "task-1" }),
        createSubTask({ id: "task-2" }),
        createSubTask({ id: "task-3" }),
      ];

      const enrichedTasks = await enrichTasks(
        tasks,
        { resource: "repo/test", runId: "run-123" },
        mockSource
      );

      expect(enrichedTasks).toHaveLength(3);
      expect(mockSource.queryExecutions).toHaveBeenCalledTimes(3);
      // All tasks should have enrichment applied
      expect(
        enrichedTasks.every((t) =>
          t.requirement.includes("Prior Similar Tasks")
        )
      ).toBe(true);
    });

    it("should handle individual task enrichment failures", async () => {
      let callCount = 0;
      const mockSource: EnrichmentSource = {
        queryExecutions: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 2) {
            throw new Error("DB error for task 2");
          }
          return [createSimilarExecution()];
        }),
        queryHeuristics: vi.fn().mockResolvedValue([]),
      };

      const tasks = [
        createSubTask({ id: "task-1", requirement: "Task 1" }),
        createSubTask({ id: "task-2", requirement: "Task 2" }),
        createSubTask({ id: "task-3", requirement: "Task 3" }),
      ];

      const enrichedTasks = await enrichTasks(
        tasks,
        { resource: "repo/test", runId: "run-123" },
        mockSource
      );

      expect(enrichedTasks).toHaveLength(3);
      // Task 2 should be unchanged (error during enrichment)
      expect(enrichedTasks[1].requirement).toBe("Task 2");
      // Task 1 and 3 should be enriched
      expect(enrichedTasks[0].requirement).toContain("Prior Similar Tasks");
      expect(enrichedTasks[2].requirement).toContain("Prior Similar Tasks");
    });
  });

  describe("generateResolutionDelta", () => {
    beforeEach(() => {
      // Reset mocks
      vi.clearAllMocks();
      // Set offline mode to false for LLM tests
      delete process.env.ALFRED_CLASSIFY_OFFLINE;
    });

    it("should generate delta using LLM", async () => {
      const failure = createFailureContext({
        status: "failure",
        toolErrors: [
          {
            count: 1,
            error: "Module not found: lodash",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      const success = {
        durationMs: 3000,
        filesChanged: ["package.json"],
        toolsUsed: ["shell", "write"],
      };

      const delta = await generateResolutionDelta(failure, success);

      expect(delta.delta).toBeDefined();
      expect(delta.keyInsight).toBeDefined();
      expect(delta.category).toBeDefined();
    });

    it("should use heuristic fallback in offline mode", async () => {
      process.env.ALFRED_CLASSIFY_OFFLINE = "1";

      // No tool errors, so it will fall through to file-based detection
      const failure = createFailureContext({
        toolErrors: [],
      });

      // Use requirements.txt which triggers deps without matching config patterns
      const success = {
        durationMs: 1000,
        filesChanged: ["requirements.txt"],
        toolsUsed: ["write"],
      };

      const delta = await generateResolutionDelta(failure, success);

      expect(delta.delta).toBeDefined();
      expect(delta.category).toBe("deps"); // requirements.txt change = deps
    });

    it("should detect config fixes heuristically", async () => {
      process.env.ALFRED_CLASSIFY_OFFLINE = "1";

      const failure = createFailureContext();
      const success = {
        durationMs: 1000,
        filesChanged: ["tsconfig.json", "config/app.yaml"],
        toolsUsed: [],
      };

      const delta = await generateResolutionDelta(failure, success);

      expect(delta.category).toBe("config");
      expect(delta.keyInsight).toContain("config");
    });

    it("should detect transient issues when no files changed", async () => {
      process.env.ALFRED_CLASSIFY_OFFLINE = "1";

      const failure = createFailureContext();
      const success = {
        durationMs: 1000,
        filesChanged: [],
        toolsUsed: [],
      };

      const delta = await generateResolutionDelta(failure, success);

      expect(delta.category).toBe("environment");
      expect(delta.keyInsight).toContain("transient");
    });

    it("should identify tools that succeeded after failure", async () => {
      process.env.ALFRED_CLASSIFY_OFFLINE = "1";

      const failure = createFailureContext({
        toolErrors: [
          {
            count: 2,
            error: "Failed",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      const success = {
        durationMs: 2000,
        filesChanged: ["src/app.ts"],
        toolsUsed: ["shell", "write"],
      };

      const delta = await generateResolutionDelta(failure, success);

      expect(delta.category).toBe("logic");
      expect(delta.delta).toContain("shell");
    });
  });
});
