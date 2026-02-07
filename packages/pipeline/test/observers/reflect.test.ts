import { beforeEach, describe, expect, it, mock } from "bun:test";

const warn = mock(() => {});
const info = mock(() => {});
const error = mock(() => {});
const debug = mock(() => {});

mock.module("@alfred/logger", () => ({
  logger: { warn, info, error, debug },
}));

// Mock the AI SDK generateObject call
const mockGenerateObject = mock(() =>
  Promise.resolve({
    object: {
      learnings: [
        {
          insight:
            "Use explicit error handling in database connection retries to avoid silent failures",
          category: "error_handling",
          confidence: 0.85,
        },
      ],
    },
  })
);

mock.module("ai", () => ({
  generateObject: mockGenerateObject,
}));

// Mock the classification model selector
const mockModel = { modelId: "test-model" };
const mockGetClassificationModel = mock(() => ({
  model: mockModel,
  modelKey: "test-model",
  capabilities: [],
}));

mock.module("@alfred/agent/selector", () => ({
  getClassificationModel: mockGetClassificationModel,
}));

import type {
  GatherExecutionContextFn,
  PersistLearningFn,
} from "../../src/observers/reflect";

import { createEvent } from "../../src/events";
import { ReflectionObserver } from "../../src/observers/reflect";

const waitFor = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

function makeSignals(description: string) {
  return {
    friction: [
      {
        type: "error_event" as const,
        severity: "low" as const,
        timing: "lagging" as const,
        confidence: 0.5,
        stepNumber: 1,
        description,
        citations: [] as never[],
        detectedAt: Date.now(),
        metadata: {} as Record<string, unknown>,
      },
    ],
    delight: [] as never[],
    interventions: [] as never[],
  };
}

function makeGatherContext(
  overrides: Partial<{
    errors: string[];
    toolFailures: string[];
    agentOutcomes: string[];
    compilation: Record<string, unknown> | null;
  }> = {}
): GatherExecutionContextFn {
  return async () => ({
    compilation: overrides.compilation ?? { stages: [], summaryText: "ok" },
    eventSummary: {
      errors: overrides.errors ?? [],
      toolFailures: overrides.toolFailures ?? [],
      agentOutcomes: overrides.agentOutcomes ?? [],
    },
  });
}

describe("ReflectionObserver (LLM-driven)", () => {
  beforeEach(() => {
    warn.mockClear();
    info.mockClear();
    error.mockClear();
    debug.mockClear();
    mockGenerateObject.mockClear();
    mockGetClassificationModel.mockClear();
  });

  it("calls LLM and persists structured learnings on complete", async () => {
    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-llm-1",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext({
        errors: ["connection timeout"],
      }),
      persistLearning,
    });

    observer.onEvent(
      createEvent("pipeline:complete", {
        summary: {
          runId: "run-llm-1",
          requirement: "test",
          stages: [],
          totalDurationMs: 0,
          agentsSpawned: 0,
          filesChanged: 0,
          learningInsights: 0,
        },
        summaryText: "ok",
      })
    );

    observer.onComplete();
    await waitFor(200);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(persisted.length).toBe(1);
    expect(persisted.at(0)?.source).toBe("llm");
    expect(persisted.at(0)?.category).toBe("error_handling");
    expect(persisted.at(0)?.confidence).toBe(0.85);
    expect(persisted.at(0)?.content).toContain("explicit error handling");
  });

  it("passes projectId through to persisted learnings", async () => {
    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-project",
      workspace: "/home/user/project",
      projectId: "project-abc-123",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    observer.onComplete();
    await waitFor(200);

    expect(persisted.length).toBeGreaterThanOrEqual(1);
    expect(persisted.at(0)?.projectId).toBe("project-abc-123");
  });

  it("is a no-op when gatherContext is undefined", async () => {
    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-no-context",
      workspace: "/home/user/project",
      persistLearning,
      // gatherContext not provided
    });

    observer.onComplete();
    await waitFor(100);

    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(persisted.length).toBe(0);
  });

  it("is a no-op when persistLearning is undefined", async () => {
    const observer = new ReflectionObserver({
      runId: "run-no-persist",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      // persistLearning not provided
    });

    observer.onComplete();
    await waitFor(100);

    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("does not persist when LLM returns empty learnings", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { learnings: [] },
    });

    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-clean",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    observer.onComplete();
    await waitFor(200);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(persisted.length).toBe(0);
  });

  it("degrades gracefully when LLM call fails", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("API unavailable"));

    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-llm-fail",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    observer.onComplete();
    await waitFor(200);

    expect(persisted.length).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      "reflection_llm_failed",
      expect.objectContaining({ runId: "run-llm-fail" })
    );
  });

  it("degrades gracefully when gatherContext fails", async () => {
    const observer = new ReflectionObserver({
      runId: "run-ctx-fail",
      workspace: "/home/user/project",
      gatherContext: async () => {
        throw new Error("DB unavailable");
      },
      persistLearning: async () => {},
    });

    observer.onComplete();
    await waitFor(200);

    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "reflection_gather_context_failed",
      expect.objectContaining({ runId: "run-ctx-fail" })
    );
  });

  it("includes friction signals in the LLM prompt context", async () => {
    const persistLearning: PersistLearningFn = async () => {};

    const observer = new ReflectionObserver({
      runId: "run-friction",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    observer.onEvent(
      createEvent("agent:signal", {
        agentId: "agent-1",
        signals: makeSignals("Repeated retry loop in execute stage"),
      })
    );

    observer.onComplete();
    await waitFor(200);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateObject.mock.calls.at(0)?.at(0) as
      | Record<string, unknown>
      | undefined;
    const prompt = String(callArgs?.prompt ?? "");
    expect(prompt).toContain("Repeated retry loop in execute stage");
  });

  it("sets outcome to failure when pipeline failed", async () => {
    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-fail-outcome",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext({
        errors: ["timeout in execute stage"],
      }),
      persistLearning,
    });

    observer.onEvent(
      createEvent("pipeline:failed", {
        error: "timeout in execute stage",
        lastStage: "execute",
      })
    );

    observer.onComplete();
    await waitFor(200);

    expect(persisted.at(0)?.outcome).toBe("failure");
  });

  it("emits learnings per spawned task ID", async () => {
    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-tasks",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    observer.onEvent(
      createEvent("agent:spawn", {
        agentId: "agent-1",
        taskId: "task-a",
      })
    );
    observer.onEvent(
      createEvent("agent:spawn", {
        agentId: "agent-2",
        taskId: "task-b",
      })
    );

    observer.onComplete();
    await waitFor(200);

    // 1 learning × 2 task IDs = 2 persisted
    expect(persisted.length).toBe(2);
    const taskIds = persisted.map((p) => p.taskId);
    expect(taskIds).toContain("task-a");
    expect(taskIds).toContain("task-b");
  });

  it("times out slow LLM calls gracefully", async () => {
    // Mock a never-resolving generateObject
    mockGenerateObject.mockReturnValueOnce(new Promise(() => {}) as never);

    const persisted: Parameters<PersistLearningFn>[0][] = [];
    const persistLearning: PersistLearningFn = async (learning) => {
      persisted.push(learning);
    };

    const observer = new ReflectionObserver({
      runId: "run-slow",
      workspace: "/home/user/project",
      gatherContext: makeGatherContext(),
      persistLearning,
    });

    // Speed up the timeout for testing
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      // Convert the 5000ms timeout to 0ms for fast test execution
      const adjusted = timeout === 5000 ? 0 : timeout;
      return originalSetTimeout(handler, adjusted, ...args);
    }) as typeof setTimeout;

    try {
      observer.onComplete();
      await new Promise((resolve) => originalSetTimeout(resolve, 50));
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(persisted.length).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      "reflection_timeout",
      expect.objectContaining({ runId: "run-slow" })
    );
  });
});
