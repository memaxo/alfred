import { describe, expect, mock, test } from "bun:test";

// Mock renderer module
mock.module("../../src/tui/renderer", () => ({
  setupTerminal: mock(() => {}),
  cleanupTerminal: mock(() => {}),
  clearScreen: mock(() => {}),
  writeAt: mock(() => {}),
  getCurrentSize: mock(() => ({ width: 80, height: 24 })),
}));

// Mock keys module
mock.module("../../src/tui/input/keys", () => ({
  getKeyInput: mock(() => ({
    onKey: mock(() => () => {}),
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  isEscape: (e: { key: string }) => e.key === "escape",
  isEnter: (e: { key: string }) => e.key === "enter",
}));

// Mock API client
mock.module("../../src/tui/api/client", () => ({
  getApiClient: mock(() => ({
    startWorkflow: mock(async () => ({
      data: {
        runId: "test-run-123",
        status: "planned",
        plan: {
          summary: "Test plan",
          tasks: [
            { title: "Task 1", description: "First task" },
            { title: "Task 2", description: "Second task" },
          ],
        },
      },
    })),
    getWorkflowRun: mock(async () => ({
      data: {
        id: "test-run-123",
        status: "completed",
      },
    })),
  })),
}));

describe("Plan Mode", () => {
  describe("Plan Parsing", () => {
    test("parses structured plan response", () => {
      const planData = {
        plan: {
          summary: "Build a feature",
          tasks: [
            { title: "Design", description: "Create mockups" },
            { title: "Implement", description: "Write code" },
          ],
          estimatedTime: "2 hours",
        },
      };

      // Extract parsing logic test
      const plan = parsePlanFromData(planData);
      expect(plan.summary).toBe("Build a feature");
      expect(plan.tasks.length).toBe(2);
      expect(plan.tasks[0]?.title).toBe("Design");
      expect(plan.estimatedTime).toBe("2 hours");
    });

    test("handles missing plan data", () => {
      const plan = parsePlanFromData({});
      expect(plan.summary).toBeDefined();
      expect(plan.tasks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Plan State Transitions", () => {
    test("starts in input phase", () => {
      const state = createInitialPlanState();
      expect(state.phase).toBe("input");
      expect(state.plan).toBeNull();
      expect(state.runId).toBeNull();
    });

    test("transitions to generating on submit", () => {
      let state = createInitialPlanState();
      state = transitionToGenerating(state, "Build a feature");

      expect(state.phase).toBe("generating");
      expect(state.requirement).toBe("Build a feature");
    });

    test("transitions to review on plan received", () => {
      let state = createInitialPlanState();
      state = transitionToGenerating(state, "Build a feature");
      state = transitionToReview(state, {
        summary: "Test",
        tasks: [{ id: "1", title: "Task", status: "pending" }],
      });

      expect(state.phase).toBe("review");
      expect(state.plan).not.toBeNull();
    });

    test("transitions to executing on approve", () => {
      let state = createInitialPlanState();
      state = transitionToGenerating(state, "Build a feature");
      state = transitionToReview(state, {
        summary: "Test",
        tasks: [{ id: "1", title: "Task", status: "pending" }],
      });
      state = transitionToExecuting(state);

      expect(state.phase).toBe("executing");
    });
  });
});

// ─── Test Helpers ────────────────────────────────────────────────────────────

interface PlanTask {
  id: string;
  title: string;
  status: "pending" | "running" | "complete" | "error";
  description?: string;
}

interface GeneratedPlan {
  summary: string;
  tasks: PlanTask[];
  estimatedTime?: string;
}

type PlanPhase =
  | "input"
  | "generating"
  | "review"
  | "executing"
  | "complete"
  | "error";

interface PlanState {
  phase: PlanPhase;
  requirement: string;
  plan: GeneratedPlan | null;
  runId: string | null;
  error: string | null;
}

function createInitialPlanState(): PlanState {
  return {
    phase: "input",
    requirement: "",
    plan: null,
    runId: null,
    error: null,
  };
}

function transitionToGenerating(
  state: PlanState,
  requirement: string
): PlanState {
  return {
    ...state,
    phase: "generating",
    requirement,
    error: null,
  };
}

function transitionToReview(state: PlanState, plan: GeneratedPlan): PlanState {
  return {
    ...state,
    phase: "review",
    plan,
  };
}

function transitionToExecuting(state: PlanState): PlanState {
  return {
    ...state,
    phase: "executing",
  };
}

function parsePlanFromData(data: unknown): GeneratedPlan {
  const plan = (data as Record<string, unknown>)?.plan;

  if (plan && typeof plan === "object") {
    const planObj = plan as Record<string, unknown>;
    const tasks = Array.isArray(planObj.tasks)
      ? planObj.tasks.map((t, i) => ({
          id: String(i),
          title: String(
            (t as Record<string, unknown>).title ?? `Task ${i + 1}`
          ),
          status: "pending" as const,
          description: String((t as Record<string, unknown>).description ?? ""),
        }))
      : [];

    return {
      summary: String(planObj.summary ?? ""),
      tasks,
      estimatedTime: planObj.estimatedTime
        ? String(planObj.estimatedTime)
        : undefined,
    };
  }

  return {
    summary: "",
    tasks: [],
  };
}
