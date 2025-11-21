import { describe, expect, it } from "bun:test";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import {
  generateSubtaskExecPlanSkeleton,
  interpretExecPlan,
  planProgressUpdate,
} from "@alfred/agent/orchestrator/multi/execplan";

describe("execplan.interpretExecPlan", () => {
  it("parses a complete plan", () => {
    const md = `
# My Plan

## Progress

- [x] (2021-01-01) Done

## Surprises & Discoveries

- Found a bug.

## Decision Log

- Decided X.

## Outcomes & Retrospective

- All good.
`;
    const parsed = interpretExecPlan(md);
    expect(parsed.title).toBe("My Plan");
    expect(parsed.progressSection).toContain("- [x] (2021-01-01) Done");
    expect(parsed.surprisesSection).toContain("- Found a bug.");
    expect(parsed.decisionLogSection).toContain("- Decided X.");
    expect(parsed.outcomesSection).toContain("- All good.");
  });

  it("handles missing sections gracefully", () => {
    const md = `# Just Title`;
    const parsed = interpretExecPlan(md);
    expect(parsed.title).toBe("Just Title");
    expect(parsed.progressSection).toBe("");
  });
});

describe("execplan.planProgressUpdate", () => {
  it("appends a new entry", () => {
    const existing = "- [ ] Old";
    const updated = planProgressUpdate(existing, {
      timestampIso: "2025-01-01",
      message: "New",
      completed: true,
    });
    expect(updated).toBe("- [ ] Old\n- [x] (2025-01-01) New");
  });

  it("creates first entry if empty", () => {
    const updated = planProgressUpdate("", {
      timestampIso: "2025-01-01",
      message: "First",
      completed: false,
    });
    expect(updated).toBe("- [ ] (2025-01-01) First");
  });
});

describe("execplan.generateSubtaskExecPlanSkeleton", () => {
  it("generates a formatted markdown file", () => {
    const task: SubTask = {
      id: "T1",
      title: "Task 1",
      requirement: "Do something",
      deps: [],
      priority: 1,
      acceptance: ["It works"],
      filesHint: ["src/index.ts"],
    };

    const md = generateSubtaskExecPlanSkeleton(task, "run-123");
    
    expect(md).toContain("# Task 1 (Run run-123, T1)");
    expect(md).toContain("## Purpose / Big Picture");
    expect(md).toContain("Do something");
    expect(md).toContain("- It works");
    expect(md).toContain("- src/index.ts");
    expect(md).toContain("## Progress");
    expect(md).toContain("- [ ] (pending) Initialised ExecPlan skeleton.");
  });
});
